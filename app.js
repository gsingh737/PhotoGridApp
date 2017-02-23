const express = require('express');
const path = require('path');
const config = require('./config/config');
const knox = require('knox');
const fs = require('fs');
const os = require('os');
const formidable = require('formidable');
const gm = require('gm');
const mongoose =require('mongoose').connect(config.dburl, (err) => {
    console.log(err);
});

var app = express();
app.set('views', path.join(__dirname, 'views'));
app.engine('html', require('hogan-express'));
app.set('view engine', 'html');

app.use(express.static(path.join(__dirname, 'public')));
app.set('port', process.env.PORT||3000);
app.set('host' + config.host);
let knoxClient = knox.createClient({
    key: config.S3AccessKey,
    secret: config.S3Secret,
    bucket: config.S3Bucket
});
let http = require('http')
let server = http.createServer(app);
http.globalAgent.maxSockets = 1024;
let io = require('socket.io')(server);
require('./routes/routes')(express, app, formidable, fs, os, gm, knoxClient, mongoose, io);

server.listen(app.get('port'), () => {
    console.log(`Photo grid running on ${app.get('port')}`);
});