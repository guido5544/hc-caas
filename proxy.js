const config = require('config');

const fs = require('fs');
const path = require('path');

const express = require('express');
var mongoose = null;
const multer = require('multer');
const cors = require('cors');

const http = require("http");
const https = require("https");

const app = express();

app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: false }));



const conversionservice = require('./app');
var server;

var util = require('util');
var log_file = fs.createWriteStream(__dirname + '/debug.log', {flags : 'a'});
var log_stdout = process.stdout;

console.log = function(d) { //
  log_file.write(util.format(d) + '\n');
  log_stdout.write(util.format(d) + '\n');
};

var httpProxy = require('http-proxy');

var proxy = httpProxy.createProxyServer({});

if (config.has("hc-caas.proxy.keyPath") && config.get("hc-caas.proxy.keyPath") != "") {
    const options = {
        key: fs.readFileSync(config.get("hc-caas.proxy.keyPath")),
        cert: fs.readFileSync(config.get("hc-caas.proxy.certPath"))
      };

    var server = https.createServer(options, function (req, res) {
        // You can define here your custom logic to handle the request
        // and then proxy the request.
        proxy.web(req, res, { target: 'http://127.0.0.1:' + config.get("hc-caas.port") });
    });
    server.listen(443);
}
else {
    server = http.createServer(function (req, res) {
        proxy.web(req, res, { target:'http://127.0.0.1:' + config.get("hc-caas.port") });
    });
    server.listen(80);
}

proxy.on('error', function (err, req, res) {
    console.log(err);
});

server.on('upgrade', async function (req, socket, head) {
    console.log("Client IP:" + req.socket.remoteAddress);
    proxy.ws(req, socket, head, { target: 'ws://127.0.0.1:3200' });
});


function callback(args) {
    console.log(args);
}

conversionservice.start(null, callback);