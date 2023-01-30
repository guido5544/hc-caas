#!/usr/bin/env node
var app = require('../app.js');

if (require.main === module) {
    app.start();
}