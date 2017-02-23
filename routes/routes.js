module.exports = (express, app, formidable, fs, os, gm, knoxClient, mongoose, io) => {
    let Socket;
    io.on('connection', (socket) => {
        Socket = socket;
    });
    let singleImage = new mongoose.Schema({
        filename: String,
        votes: Number
    });
    let singleImageModel = mongoose.model('singleImage', singleImage);
    let router = express.Router();
    router.get('/', (req, res, next) => {
        res.render('index', {host: app.get('host')});
    });
    router.post('/upload', (req, res, next) => {
        //File Upload
        function generateFilename(filename) {
            var ext_regex = /(?:\.([^.]+))?$/;
            var ext = ext_regex.exec(filename)[1];
            var date = new Date().getTime();
            var charBank = 'abcdefghijklmnopqrstuvwxyz';
            var fstring = '';
            for (var i = 0; i < 15; i++) {
                fstring += charBank[parseInt(Math.random()*26)];
            }
            return (fstring += date + '.' + ext);
        }

        let tmpFile, nfile, fname;
        let newForm = new formidable.IncomingForm();
            newForm.keepExtensions = true;
            newForm.parse(req, (err, fields, files) => {
                tmpFile = files.upload.path;
                fname = generateFilename(files.upload.name);
                nfile = os.tmpDir() + '/' + fname;
                res.writeHead(200, {'content-type' : 'text-plain'});
                res.end();
            });
            newForm.on('end', () => {
               fs.rename(tmpFile, nfile, () => {
                    //resize this file and upload to the s3 bucket
                   //overwrite file on server
                   gm(nfile).resize(300).write(nfile, () => {
                        fs.readFile(nfile, (err, buffer) => {
                            let req = knoxClient.put(fname, {
                                'Content-Length':buffer.length,
                                'Content-Type':'image/jpeg'
                            });
                            req.on('response', (res) => {
                                console.log(res.statusCode);
                               if(res.statusCode  == 200){
                                   //This means file is in S3 bucket
                                   let newImage = new singleImageModel({
                                       filename: fname,
                                       votes: 0
                                   }).save();

                                   Socket.emit('status', {'msg': 'Saved!!', 'delay': 3000});
                                   Socket.emit('doUpdate', {});
                                   //delete the local file
                                   fs.unlink(nfile, () => {
                                       console.log('Local file deleted');
                                   });
                               }
                            });
                            req.end(buffer);
                        });
                   });
               });
            });

    });
    router.get('/getImages', (req, res, next) => {
        //ie null in find is to specify specific fields in database ie name, id etc
        singleImageModel.find({}, null, {sort : {votes: -1}}, (err, result) => {
            res.send(JSON.stringify(result));
        });
    });
    router.get('/voteup/:id', (req, res, next) => {
       singleImageModel.findByIdAndUpdate(req.params.id, {$inc: {votes: 1}}, {new : true}, (err, result) => {
          res.status(200).send(JSON.stringify({votes: result.votes}));
       });
    });
    app.use('/', router);
};