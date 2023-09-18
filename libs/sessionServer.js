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



var maxStreamingSessionsSoFar = 0;
var totalStreamingSessionsSoFar = 0;

var storage;

var serveraddress;

var startport = 4000;


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
        this._simStreamingSessions = 0;
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


        var proxyServer = http.createServer(function (req, res) {

            let i=0;

        });


        proxy.on('error', function (err, req, res) {
            console.log(err);
        });

        // proxyServer.on('upgrade', async function (req, socket, head) {
        //     let s = req.url.split("=");

        //     let item;
        //     try {
        //         item = await Streamingsessionitem.findOne({ _id: s[1] });
        //     }
        //     catch (e) {
        //         console.log(e);
        //         return;
        //     }
        //     if (item && (item.slot != undefined)) {
        //         let port = item.slot + startport;
        //         try {
        //             proxy.ws(req, socket, head, { target: 'ws://127.0.0.1:' + port });
        //         }
        //         catch (e) {
        //             console.log("proxy issue:" + e);
        //         }
        //     }
        // });

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
        await this.runSessionServer(slot, item.id, streamingLocation);

        let sessionServer = await SessionServerItem.findOne({ type: this._type, address: serveraddress });
        sessionServer.freeSessionSlots = this._maxSessions - this._simStreamingSessions;
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


    async getFileFromStorage(item, sessionid, itemname, subdirectory) {

        if (localCache.isInCache(item.storageID, itemname)) {
            console.log("file loaded from cache");
            if (false) {
                //        if (config.get('hc-caas.streamingServer.useSymLink')) {            
                const dir = tempFileDir + "/" + sessionid + subdirectory;
                await localCache.createSymLink(item.storageID, itemname, dir + "/" + itemname);
            }
            else {
                const data = await localCache.readFile(item.storageID, itemname);
                if (!data)
                    return false;
                const dir = tempFileDir + "/" + sessionid + subdirectory;
                await fsPromises.writeFile(dir + "/" + itemname, data);
            }
            return;
        }

        //    if (config.get('hc-caas.storage.type') == 'filesystem' && config.get('hc-caas.streamingServer.useSymLink')) {
        if (false) {
            const dir = tempFileDir + "/" + sessionid + subdirectory;
            await storage.createSymLink("conversiondata/" + item.storageID + "/" + itemname, dir + "/" + itemname);
        }
        else {
            const data = await storage.readFile("conversiondata/" + item.storageID + "/" + itemname);
            if (!data)
                return false;
            const dir = tempFileDir + "/" + sessionid + subdirectory;

            await fsPromises.writeFile(dir + "/" + itemname, data);

            localCache.cacheFile(item.storageID, itemname, data);
        }
    }
}


module.exports = CustomSessionServer;