#!/usr/bin/env node
var app = require('../app.js');

if (require.main === module) {
    console.log(process.cwd());
    process.env["NODE_CONFIG_DIR"] = __dirname + "./../config" + ";" + process.cwd() + "/config";
    app.start();
}