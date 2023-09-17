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
var accountRoutes;

var conversionQueue;
var streamingServer;
var streamingManager;

process.env.ALLOW_CONFIG_MUTATIONS = "true";
process.env.SUPPRESS_NO_CONFIG_WARNING = 'y';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"

const config = require('config');



function getPublicIP() {
  return new Promise((resolve, reject) => {
    var http = require('http');

    try {
    http.get({ 'host': 'api.ipify.org', 'port': 80, 'path': '/' }, function (resp) {
      resp.on('data', function (ip) {
        resolve(ip);
      });
    });
  }
  catch {
    reject();
  }
  });
}

exports.start = async function (mongoose_in, extraArgs = {}) {
  handleInitialConfiguration();


  try {
    if (!config.has('hc-caas.serviceIP') || config.get('hc-caas.serviceIP') == "") {
      global.caas_publicip = (await getPublicIP()).toString();
    }
    else {
      global.caas_publicip = config.get('hc-caas.serviceIP');
    }
  }
  catch {
    console.log("ERROR - Unable to determine public IP address.  Please set hc-caas.serviceIP in config file.");
    global.caas_publicip = "";
  }


  try {
    config.get('hc-caas');
  } catch (e) {
    console.log("Error: Can't find configuration data. Make sure you have a config folder with a default.json file and a hc-caas object in the root directory of the project.");
    exit(0);
  }

  if (!fs.existsSync(config.get('hc-caas.workingDirectory'))) {
    fs.mkdirSync(config.get('hc-caas.workingDirectory'));
  }

  let versioninfo = require('./package.json');
  process.env.caas_version = versioninfo.version;
  console.log("Initializing CaaS. Version: " + process.env.caas_version);
  console.log("CaaS Service IP: " + global.caas_publicip);
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

  exports.modelManager = require('./libs/modelManager');

  try {
    if (config.get('hc-caas.runConversionServer')) {
      conversionQueue = require('./libs/conversionServer');
      conversionQueue.start();
    }

    if (config.get('hc-caas.runModelManager')) {
      exports.modelManager.start(extraArgs.customCallback, extraArgs.conversionPriorityCallback);
      if (config.get('hc-caas.modelManager.runStreamingManager')) {
        streamingManager.start();
      }
    }

    if (config.get('hc-caas.runStreamingServer')) {
      streamingServer = require('./libs/streamingServer');
      streamingServer.start();
    }    

    if ((config.get('hc-caas.runModelManager') && config.get('hc-caas.modelManager.listen')) || config.get('hc-caas.runConversionServer') ||  config.get('hc-caas.runStreamingServer')) {
      app.use(cors());
      app.use(express.json({ limit: '25mb' }));
      app.use(express.urlencoded({ limit: '25mb', extended: false }));


      if (config.get('hc-caas.accessPassword') != "") {
        app.use(function (req, res, next) {
          if (req.get("CS-API-Arg")) {
            let args = JSON.parse(req.get("CS-API-Arg"));
            if (args.accessPassword == config.get('hc-caas.accessPassword') || (args.accessKey && config.get('hc-caas.requireAccessKey'))) {
              return next();
            }
          }
        });
      }

      if (config.get('hc-caas.runModelManager') && config.get('hc-caas.modelManager.listen')) {
        const fileStorage = multer.diskStorage({
          destination: (req, file, cb) => {
            var uv4 = uuidv4();
            if (!fs.existsSync(config.get('hc-caas.workingDirectory') + "/uploads")) {
              fs.mkdirSync(config.get('hc-caas.workingDirectory') + "/uploads");
            }
            let dir = config.get('hc-caas.workingDirectory') + "/uploads/" + uv4;
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

        app.post('/caas_api/upload',upload.single('file'));
        app.post('/caas_api/uploadArray',upload.array('files'));

        serverapiRoutes = require('./routes/modelManagerAPI');
        app.use("/caas_api", serverapiRoutes);
      }

      if (config.get('hc-caas.runModelManager') && config.get('hc-caas.requireAccessKey')) {
        accountRoutes = require('./routes/accountAPI');
        app.use("/caas_api/accounts/", accountRoutes);
      }

      if (config.get('hc-caas.runConversionServer')) {
        queueapiRoutes = require('./routes/conversionServerAPI');
        app.use("/caas_api", queueapiRoutes);
      }

      if (config.get('hc-caas.runStreamingServer')) {
        streamingserverapiRoutes = require('./routes/streamingServerAPI');
        app.use("/caas_api", streamingserverapiRoutes);
      }
      
      app.listen(config.get('hc-caas.port'));
      console.log("caas listening on port " + config.get('hc-caas.port'));
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
      "accessPassword": "",
      "workingDirectory": "caasTemp",
      "serviceIP": "localhost",
      "port": "3001",
      "runModelManager": true,
      "runConversionServer": true,
      "runStreamingServer": true,
      "license": "",
      "licenseFile": "",
      "fullErrorReporting": false,
      "region": "",
      "requireAccessKey": false,
      "determineGeoFromRequest": false,
      "sessionPlugins": [],
      "conversionServer": {
        "name" : "",
        "converterpath": "",
        "HEimportexportpath": "",
        "HEInstallPath": "",
        "maxConversions": 4,
        "polling": false,
        "allowSCSConversion": true,
        "imageServicePort": "3002",
        "priority": 0,
      },
      "modelManager": {
        "listen": true,
        "purgeFiles": false,
        "runStreamingManager": true,
      },
      "streamingServer": {
        "streamingRegion": "",
        "scserverpath": "",
        "renderType": "client",
        "useEGL": false,
        "maxStreamingSessions": 10,
        "useSymLink": false,
        "publicURL": "",
        "publicPort": "",
        "startPort": 3006,
        "listenPort": 3200,
        "name" : "",
        "priority": 0,
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
      }
  };

  config.util.setModuleDefaults('hc-caas', configs);

}