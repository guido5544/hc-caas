const fs = require('fs');
const config = require('config');
const del = require('del');
const SessionServerItem = require('../models/sessionServerItem');
const SessionItem = require('../models/sessionItem');

const Conversionitem = require('../models/conversionitem');
const fsPromises = fs.promises;
const path = require('path');


const localCache = require('./localCache');

const authorization = require('./authorization');


const execFile = require('child_process').execFile;

let tempFileDir = "";
const http = require('http');
var httpProxy = require('http-proxy');

var storage;

var serveraddress;
function someTimeout(to) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, to);
    });
}

function start() {

    tempFileDir = config.get('hc-caas.workingDirectory');
    serveraddress = global.caas_publicip + ":" + config.get('hc-caas.port');
    storage = require('./permanentStorage').getStorage();
};



class CustomSessionServer {

    constructor(type, serverinfo) {

        if (!storage) {
            start();
        }

        this._type = type;
        this._name = serverinfo.name;
        this._maxSessions = serverinfo.maxSessions ? serverinfo.maxSessions : 10;
        this._startPort = serverinfo.startPort;
        this._slots = [];
        this._region = serverinfo.region ? serverinfo.region : "";
        this._priority = serverinfo.priority != undefined ? serverinfo.priority :0;
        this._listenPort = serverinfo.listenPort;
        this._publicPort = serverinfo.publicPort ? serverinfo.publicPort : "";
        this._publicURL = serverinfo.publicURL ? serverinfo.publicURL : "";
        this._simSessions = 0;
        this._exePath = serverinfo.exePath;
        this._path = serverinfo.path;
        this._dllPath = serverinfo.dllPath;

        this.start();
    }



    findFreeSlot() {
        for (let i = 0; i < this._maxSessions; i++) {
            if (this._slots[i]) {
                this._slots[i] = false;
                return i;
            }
        }
        return -1;
    }


    async start() {

        for (let i = 0; i < this._maxSessions; i++) {
            this._slots[i] = true;
        }



        let server = await SessionServerItem.findOne({ type: this._type, address: serveraddress });
        if (!server) {
            server = new SessionServerItem({
                type: this._type,
                name: this._name,
                address: serveraddress,
                freeSessionSlots: this._maxSessions,
                region: config.get('hc-caas.region'),
                sessionRegion: this._region,
                lastPing: new Date(),
                priority: this._priority,
                pingFailed: false
            });
            server.save();
        }
        else {
            server.name = this._name;
            server.freeSessionSlots = this._maxSessions;
            server.region = config.get('hc-caas.region');
            server.priority = config.get('hc-caas.streamingServer.priority');
            server.sessionRegion = this._region;
            server.pingFailed = false;
            server.lastPing = new Date();
            server.save();
        }


        let dname = "/" + this._type + "temp";
        if (!fs.existsSync(tempFileDir)) {
            fs.mkdirSync(tempFileDir);
        }

        if (!fs.existsSync(tempFileDir + dname)) {
            fs.mkdirSync(tempFileDir + dname);
        }

        tempFileDir += dname;


        var proxy = new httpProxy.createProxyServer({
        });


        let _this = this;
        var proxyServer = http.createServer(async function (req, res) {
            let sessionid = req.headers['sessionid'];

            let item;
            try {
                item = await SessionItem.findOne({ _id: sessionid });
            }
            catch (e) {
                console.log(e);
                return;
            }
            if (item && (item.slot != undefined)) {
                let port = item.slot + _this._startPort;
                try {
                    proxy.web(req, res, { target: 'http://127.0.0.1:' + port });
                }
                catch (e) {
                    console.log("proxy issue:" + e);
                }
            }
        });

        proxy.on('error', function (err, req, res) {
            console.log(err);
        });
     
        proxyServer.listen(this._listenPort);
        console.log('Streaming Server started');

    }

    async startServer(args) {
        let slot = this.findFreeSlot();
        if (slot == -1) {
            return { ERROR: "No free slots" };
        }

        const item = new SessionItem({
            type: this._type,
            slot: slot,
            serveraddress: serveraddress,
        });

        let streamingLocation;

        await item.save();


        let sessiondir = tempFileDir + "/" + item.id;
        fs.mkdirSync(sessiondir);

        let conversionItem;
        if (args.storageID != undefined) {
            conversionItem = await authorization.getConversionItem(args.storageID, args);
            await this.getFileFromStorage(conversionItem, item.id, conversionItem.name + ".prc");
        }

        await this.runSessionServer(slot, item.id, conversionItem);

        let sessionServer = await SessionServerItem.findOne({ type: this._type, address: serveraddress });
        sessionServer.freeSessionSlots = this._maxSessions - this._simSessions;
        await sessionServer.save();

        let port;

        if (this._publicPort != "") {
            port = this._publicPort;
        }
        else {
            port = this._listenPort;
        }
        let address;

        if (this._publicURL != "") {
            let split = this._publicURL.split(":");
            if (split.length == 3) {
                port = this._publicURL.split(":")[2];
            }
            address = this._publicURL.replace(/(wss?:\/\/)/gi, '').split(":")[0];
        }
        else {
            address = global.caas_publicip.replace(/(https?:\/\/)/gi, '').split(":")[0];
        }


        return { serverurl: address, sessionid: item.id, port: port };

    }

    
    async runSessionServer(slot, sessionid, conversionitem) {

        this._simSessions++;
 
        console.log("Custom Session Started at " + new Date());

        let commandLine = this.setupCommandLine(slot + this._startPort, sessionid, conversionitem);

        let _this = this;
        execFile(this._exePath, commandLine, {
            cwd: this._path
        }, async function (err, data) {
            _this._simSessions--;

            let server = await SessionServerItem.findOne({ address: serveraddress });
            server.freeStreamingSlots = _this._maxSessions - _this._simSessions;
            await server.save();

            let item = await SessionItem.findOne({ _id: sessionid });
            await del(tempFileDir + "/" + item.id, { force: true });
            item.delete();
            _this._slots[slot] = true;
            console.log("Custom session ended");
            if (err == null) {
            }
            else {
                if (config.get("hc-caas.fullErrorReporting")) {
                    console.error(err);
                    console.error(data);
                }
                console.error("ERROR: Could not start Session server.");
            }
        });
        await someTimeout(500);
    }

    setupCommandLine(port, sessionid, item) {

        let commandLine;    
        commandLine = [config.get('hc-caas.license')];
        commandLine.push(this._dllPath);
   
        commandLine.push(port.toString());
        commandLine.push(path.resolve(tempFileDir + "/" + sessionid + "/" + item.name + ".prc"));    
        return commandLine;
    }


    async getFileFromStorage(item, sessionid, itemname) {

        if (localCache.isInCache(item.storageID, itemname)) {
            console.log("file loaded from cache");
            const data = await localCache.readFile(item.storageID, itemname);
            if (!data)
                return false;
            const dir = tempFileDir + "/" + sessionid;
            await fsPromises.writeFile(dir + "/" + itemname, data);
            return;
        }

        const data = await storage.readFile("conversiondata/" + item.storageID + "/" + itemname);
        if (!data)
            return false;
        const dir = tempFileDir + "/" + sessionid;

        await fsPromises.writeFile(dir + "/" + itemname, data);
        localCache.cacheFile(item.storageID, itemname, data);

    }
}


module.exports = CustomSessionServer;