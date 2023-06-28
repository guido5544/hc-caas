const fs = require('fs');
const path = require('path');

const express = require('express');
var mongoose = null;
const multer = require('multer');
const cors = require('cors');

const { v4: uuidv4 } = require('uuid');
const { exit } = require('process');

const app = express();

var serverapiRoutes;
var queueapiRoutes;
var streamingserverapiRoutes;

var conversionQueue;
var streamingServer;
var streamingManager;

process.env.ALLOW_CONFIG_MUTATIONS = "true";
process.env.SUPPRESS_NO_CONFIG_WARNING = 'y';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"

const config = require('config');



exports.start = async function (mongoose_in, customCallback) {
  handleInitialConfiguration();
  try {
    config.get('hc-caas');
  } catch (e) {
    console.log("Error: Can't find configuration data. Make sure you have a config folder with a default.json file and a hc-caas object in the root directory of the project.");
    exit(0);
  }

  if (!fs.existsSync(config.get('hc-caas.workingDirectory'))) {
    fs.mkdirSync(config.get('hc-caas.workingDirectory'));
  }

  var versioninfo = require('./package.json');
  process.env.caas_version = versioninfo.version;
  console.log("Initializing CaaS. Version: " + process.env.caas_version);


  if (!mongoose_in) {
    mongoose = require('mongoose');
    let mongouri = config.get('hc-caas.mongodbURI');
    let connectionstring;
    if (process.env.DB_USERNAME != undefined)
    {
      let monogstrings  = mongouri.split('//');
      connectionstring = monogstrings[0] + "//" + process.env.DB_USERNAME + ":" + process.env.DB_PASSWORD  + monogstrings[1];
    }
    else
      connectionstring = mongouri;
    global.con = mongoose.createConnection(connectionstring);
  }
  else {
    global.con = mongoose_in;
  }

 
  streamingManager = require('./libs/streamingManager');
  exports.streamingManager = streamingManager;

  exports.server = require('./libs/server');

  try {
    if (config.get('hc-caas.runQueue')) {
      conversionQueue = require('./libs/conversionqueue');
      conversionQueue.start();
    }

    if (config.get('hc-caas.runServer')) {
      exports.server.start(customCallback);
       if (config.get('hc-caas.runStreamingManager')) {
          streamingManager.start();
       }
    }


    if (config.get('hc-caas.runStreamingServer')) {
      streamingServer = require('./libs/streamingServer');
      streamingServer.start();
    }    

    if ((config.get('hc-caas.runServer') && config.get('hc-caas.server.listen')) || config.get('hc-caas.runQueue') ||  config.get('hc-caas.runStreamingServer')) {
      app.use(cors());
      app.use(express.json({ limit: '25mb' }));
      app.use(express.urlencoded({ limit: '25mb', extended: false }));

     
      if (config.get('hc-caas.runServer') && config.get('hc-caas.server.listen')) {
        const fileStorage = multer.diskStorage({
          destination: (req, file, cb) => {
            var uv4 = uuidv4();
            if (!fs.existsSync(config.get('hc-caas.workingDirectory') + "/uploads")) {
              fs.mkdirSync(config.get('hc-caas.workingDirectory') + "/uploads");
            }
            var dir = config.get('hc-caas.workingDirectory') + "/uploads/" + uv4;
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir);
            }
            cb(null, config.get('hc-caas.workingDirectory') + "/uploads/" + uv4);
          },
          filename: (req, file, cb) => {
            cb(null, file.originalname);
          }
        });

        var upload = multer({ storage: fileStorage });

        app.post('/api/upload',upload.single('file'));
        app.post('/api/uploadArray',upload.array('files'));

        serverapiRoutes = require('./routes/serverapi');
        app.use("/api", serverapiRoutes);
      }
      if (config.get('hc-caas.runQueue')) {
        queueapiRoutes = require('./routes/queueapi');
        app.use("/api", queueapiRoutes);
      }

      if (config.get('hc-caas.runStreamingServer')) {
        streamingserverapiRoutes = require('./routes/streamingserverapi');
        app.use("/api", streamingserverapiRoutes);
      }
      
      app.listen(config.get('hc-caas.port'));
      console.log("listening on port " + config.get('hc-caas.port'));
    }

    process.on('uncaughtException', (error, origin) => {
      if (error.code === 'ECONNRESET') {
        console.error('ECONNRESET ERROR - Ignoring');
        return;
      }

      if (error.code === 'ETIMEDOUT') {
        console.error('ETIMEDOUT ERROR - Ignoring');
        return;
        
      }
      console.error('UNCAUGHT FATAL EXCEPTION:' + error.message);
      if (error.message.indexOf("Mongoose") > -1) {
        console.error('Issue with MongoDB. Is MongoDB running and mongodbURI in config set correctly?');
      }
      if (config.get("hc-caas.fullErrorReporting")) {
          console.error(error);
          console.error(origin);
      }
      process.exit(1);
    });

  } catch (e) {
    if (config.get("hc-caas.fullErrorReporting")) {
      console.log(e);
    }
    else {
      console.log("CSErrror:" + e.message);
    }
    exit(0);
  }
};



if (require.main === module) {
  this.start();
} 




function handleInitialConfiguration() {
  let configs = {
      "mongodbURI": "mongodb://127.0.0.1:27017/conversions",
      "workingDirectory": "caasTemp",
      "port": "3001",
      "runQueue": true,
      "runServer": true,
      "runStreamingManager": true,
      "runStreamingServer": true,
      "license": "",
      "fullErrorReporting": false,
      "region": "",
      "queue": {
        "name" : "",
        "converterpath": "",
        "HEimportexportpath": "",
        "HEInstallPath": "",
        "maxConversions": 4,
        "ip": "localhost",
        "polling": false,
        "imageServicePort": "3002"
      },
      "server": {
        "listen": true
      },
      "streamingServer": {
        "streamingRegion": "",
        "scserverpath": "",
        "renderType": "client",
        "maxStreamingSessions": 10,
        "useSymLink": false,
        "ip": "http://localhost:3001",
        "startPort": 3006,
        "listenPort": 3200,
        "publicAddress": "",
        "publicPort": "",
        "name" : "",
      },
      "storage": {
        "type": "filesystem",
        "destination": "",
        "copyDestinations": [],      
        "replicate": false,
        "externalReplicate": false,
        "ABS": {
          "connectionString":"",
          "accountName": ""
        }
      },
      "localCache": {
        "directory": "",
        "maxSize": 0
      },
      "proxy": {
        "keyPath": "",
        "certPath": ""
      }
  };

  config.util.setModuleDefaults('hc-caas', configs);

}