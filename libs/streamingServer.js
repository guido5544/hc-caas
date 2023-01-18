const fs = require('fs');
const config = require('config');
const del = require('del');
const Streamingserveritem = require('../models/streamingserveritem');
const Streamingsessionitem = require('../models/streamingsessionitem');
const Conversionitem = require('../models/conversionitem');
const fsPromises = fs.promises;
const path = require('path');


const localCache = require('./localCache');



const execFile = require('child_process').execFile;

const scserverexepath = './ts3d_sc_server';   
var scserverpath = '';

let tempFileDir = "";
const http = require('http');
var httpProxy = require('http-proxy');


let simStreamingSessions = 0;
var  maxStreamingSessions = 10;

var maxStreamingSessionsSoFar = 0;
var totalStreamingSessionsSoFar = 0;

var storage;
var serveraddress;

var startport = 4000;

var slots = [];

var httpTrafficTarget = null;

function findFreeSlot()
{
    for (let i=0;i<maxStreamingSessions;i++) {
        if (slots[i]) {
            slots[i] = false;
            return i;
        }
    }
    return -1;
}

exports.start = async () => {

    maxStreamingSessions = config.get('hc-caas.streamingServer.maxStreamingSessions');
    startport = config.get('hc-caas.streamingServer.startPort');

    for (let i=0;i<maxStreamingSessions;i++) {
        slots[i] = true;
    }
  
    scserverpath = config.get('hc-caas.streamingServer.scserverpath');
    tempFileDir = config.get('hc-caas.workingDirectory');
  
    storage = require('./permanentStorage').getStorage();

    let ip = config.get('hc-caas.streamingServer.ip');
    
    serveraddress = ip + ":" + config.get('hc-caas.port');

    let streamingserver = await Streamingserveritem.findOne({ address: serveraddress });
    if (!streamingserver) {
        streamingserver = new Streamingserveritem({
            address: serveraddress,
            freeStreamingSlots: maxStreamingSessions,
            region: config.get('hc-caas.region')
        });
        streamingserver.save();
    }
    else {
        streamingserver.freeStreamingSlots = maxStreamingSessions;
        streamingserver.region = config.get('hc-caas.region');
        streamingserver.save();
    }



    if (!fs.existsSync(tempFileDir)) {
        fs.mkdirSync(tempFileDir);
    }

    if (!fs.existsSync(tempFileDir + "/streamingtemp")) {
        fs.mkdirSync(tempFileDir + "/streamingtemp");
    }

    tempFileDir += "/streamingtemp";


    var proxy = new httpProxy.createProxyServer({
    });


    var proxyServer = http.createServer(function (req, res) {     
    });


    proxy.on('error', function (err, req, res) {
        console.log(err);
    });

    proxyServer.on('upgrade', async function (req, socket, head) {
        let s = req.url.split("=");

        let item = await Streamingsessionitem.findOne({ _id: s[1] });
        if (item && (item.slot != undefined)) {
            let port = item.slot + startport;
            setTimeout(function () {
                proxy.ws(req, socket, head, { target: 'ws://127.0.0.1:' + port });
            }, 200);
        }
    });

    proxyServer.listen(config.get('hc-caas.streamingServer.listenPort'));
    console.log('streaming server started');

};

exports.startStreamingServer = async (args) => {
    let slot = findFreeSlot();
    if (slot == -1)
    {
        console.log("no free slot");
        return {ERROR: "No free streaming slot"};
    }

    const item = new Streamingsessionitem({
        slot: slot,
        serveraddress: serveraddress,
      });

    let streamingLocation;
    if (args && args.startItem) {
        let citem = await Conversionitem.findOne({ 'storageID': args.startItem });
        if (citem && citem.streamingLocation) {
            item.streamingLocation = args.streamingLocation;
            streamingLocation = args.streamingLocation;
        }
    }
    await item.save();


    let sessiondir = tempFileDir + "/" + item.id;
    fs.mkdirSync(sessiondir);
    await runStreamingServer(slot, item.id, streamingLocation);

    let streamingserver = await Streamingserveritem.findOne({ address: serveraddress });
    streamingserver.freeStreamingSlots = maxStreamingSessions - simStreamingSessions;
    await streamingserver.save();

    let port = config.get('hc-caas.streamingServer.listenPort');
    let address = config.get('hc-caas.streamingServer.ip');
    
    if (config.has('hc-caas.streamingServer.publicPort') && config.get('hc-caas.streamingServer.publicPort') != "") {
        port = config.get('hc-caas.streamingServer.publicPort');
      }
      if (config.has('hc-caas.streamingServer.publicAddress') && config.get('hc-caas.streamingServer.publicAddress') != "") { 
        address = config.get('hc-caas.streamingServer.publicAddress');
      }
    return {serverurl:address, sessionid:item.id, port:port};

};


async function getFileFromStorage(item, sessionid, itemname, subdirectory) {

    if (localCache.isInCache(item.storageID,itemname)) {
        console.log("file is in cache");
        if (config.get('hc-caas.streamingServer.useSymLink')) {            
            const dir = tempFileDir + "/" + sessionid + subdirectory;
            await localCache.createSymLink(item.storageID,itemname, dir + "/" + itemname);
        }
        else {
            const data = await localCache.readFile(item.storageID,itemname);
            if (!data)
                return false;
            const dir = tempFileDir + "/" + sessionid + subdirectory;    
            await fsPromises.writeFile(dir + "/" + itemname, data);
        }
        return;
    }

    if (config.get('hc-caas.storageBackend') != 's3' && config.get('hc-caas.streamingServer.useSymLink')) {
        const dir = tempFileDir + "/" + sessionid + subdirectory;
        await storage.createSymLink("conversiondata/" + item.storageID + "/" + itemname, dir + "/" + itemname);
    }
    else {
        const data = await storage.readFile("conversiondata/" + item.storageID + "/" + itemname);
        if (!data)
            return false;
        const dir = tempFileDir + "/" + sessionid + subdirectory;

        await fsPromises.writeFile(dir + "/" + itemname, data);

        localCache.cacheFile(item.storageID,itemname,data);
    }
}
  
function someTimeout(to) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, to);
    });
}


exports.serverEnableStreamAccess = async (sessionid, itemids, args, hasNames = false) => {

    let session = await Streamingsessionitem.findOne({ _id: sessionid });
    var starttime = new Date();
    if (session && itemids) {

        let items;

        if (!hasNames) {
            items = await Conversionitem.find({ 'storageID': { $in: itemids } });
        }
        else {
            items = await Conversionitem.find({ 'name': { $in: itemids } });

        }

        let subdirectory = "";
        if (args && args.subDirectory) {
            fs.mkdirSync(tempFileDir + "/" + sessionid + "/" + args.subDirectory);
            subdirectory = "/" + args.subDirectory;
        }
    
        for (let i = 0; i < itemids.length; i++) {
            let item = items[i];
            if (item) {
                console.log("Stream Access:" + item.name);
                if (item.streamLocation && item.streamLocation != "") {
                    let file = path.basename(item.streamLocation);
                    if (config.has('hc-caas.streamingServer.overrideStreamLocation')) {
                        await storage.createSymLinkDir(config.get('hc-caas.workingDirectory') + "/permanentStorage/conversiondata" + "/" + file, tempFileDir + "/" + sessionid + subdirectory + "/" + file);
                        continue;                        
                    }
                    else {
                        await storage.createSymLinkDir(item.streamLocation, tempFileDir + "/" + sessionid + subdirectory + "/" + file);
                        continue;
                    }
                }

                if (item.name.indexOf(".scz") != -1) {
                    item.files.push(item.name);
                }
                for (let j = 0; j < item.files.length; j++) {
                    if (item.files[j].indexOf(".scz") != -1) {
                        let itemname = item.files[j];
                        if (!fs.existsSync(tempFileDir + "/" + sessionid + subdirectory + "/" + itemname)) {
                            await getFileFromStorage(item, sessionid,itemname, subdirectory);
                        }
                    }
                }
            }
        }
        
        if (config.get('hc-caas.storageBackend') == 's3') {
       //     await someTimeout(300);
        }
        else {
            if (!config.get('hc-caas.streamingServer.useSymLink')) {
                await someTimeout(300);
            }
        }
        var endtime = new Date();
//        console.log("storage load time:" + (endtime - starttime));
    }
};


async function runStreamingServer(slot,sessionid, streamingLocation) {
 
    simStreamingSessions++;
    totalStreamingSessionsSoFar++;
    if (maxStreamingSessionsSoFar < simStreamingSessions) {
        maxStreamingSessionsSoFar = simStreamingSessions;
    }    
    console.log("Streaming Session Started at " + new Date());
    console.log("Total sessions:" + totalStreamingSessionsSoFar + " Concurrent Sessions:" + simStreamingSessions +" Max Concurrent sessions:" + maxStreamingSessionsSoFar);
    let commandLine = setupCommandLine(slot + startport,sessionid, streamingLocation);
    execFile(scserverexepath, commandLine, {
      cwd: scserverpath
    }, async function (err, data) {
        simStreamingSessions--;

        let streamingserver = await Streamingserveritem.findOne({ address: serveraddress });
        streamingserver.freeStreamingSlots = maxStreamingSessions - simStreamingSessions;
        await streamingserver.save();
    

        let item = await Streamingsessionitem.findOne({ _id:sessionid });
        await del(tempFileDir + "/" + item.id,{force: true});
        item.delete();
        slots[slot] = true;
        console.log("streaming session ended");
        if (err == null) {       
      }
      else {
        if (config.get("hc-caas.fullErrorReporting")) {
            console.error(err);
            console.error(data);
        }
        console.error("ERROR: Could not start streaming server. Check license and scserverpath path in config. Are required redistributables installed?");
      }
    });
 //   await someTimeout(500);
    
  }



function setupCommandLine(port,sessionid, streamingLocation) {

    let commandLine;

    let dirs = tempFileDir + "/" + sessionid;
    if (streamingLocation) {
        dirs += ";" + streamingLocation;
    }

    commandLine = ['--license', config.get('hc-caas.license'),
        '--id', "test123",
        '--sc-port', port.toString(),
//        '--ssr', "1",
        '--model-search-directories',dirs];

    return commandLine;
}


