const conversionQueue = require('../libs/conversionqueue');
const server = require('../libs/server');
const streamingManager = require('../libs/streamingManager');
const streamingServer = require('../libs/streamingServer');

const config = require('config');

exports.postFileUpload = async (req, res, next) => {

    console.log("upload start");
    if (req.file == undefined)
    {
        res.json({ERROR:"No file provided for upload"});
        return;
    }
    
    let args;
    if (req.get("CS-API-Arg"))
        args = JSON.parse(req.get("CS-API-Arg"));
    else
        args = {};

    if (args.itemid != undefined) {
        let data = await server.append(req.file.destination, req.file.originalname, args.itemid);     
        res.json(data);
    }
    else {
        let data = await server.create(req.file.destination, req.file.originalname, args);
        res.json(data);
    }

};



exports.postFileUploadArray = async (req, res, next) => {
  
    let args;
    if (req.get("CS-API-Arg"))
        args = JSON.parse(req.get("CS-API-Arg"));
    else
        args = {};
    
     let data = await server.createMultiple(req.files, args);
     res.json(data);
};

exports.putCreate = async (req, res, next) => {
    let args;
    if (req.get("CS-API-Arg")) {
        args = JSON.parse(req.get("CS-API-Arg"));
        let data = await server.createEmpty(args);
        res.json(data);
    }
    else {
        res.json({ ERROR: "Need additional arguments" });
        return;
    }
};

exports.getUploadToken = async (req, res, next) => {

    console.log("upload token send");
    let args = JSON.parse(req.get("CS-API-Arg"));

    let result = await server.requestUploadToken(req.params.name, args);
    res.json(result);
};



exports.getDownloadToken = async (req, res, next) => {

    console.log("download token send");
    let result = await server.requestDownloadToken(req.params.itemid,req.params.type);
    res.json(result);
};

exports.getData = async (req, res, next) => {

    let data = await server.getData(req.params.itemid);   
    res.json(data);
};

exports.pingQueue = (req, res, next) => {    
    if (config.get('hc-caas.runQueue')) {
        res.sendStatus(200);
    }
    else {
        res.sendStatus(404);
    }
};


exports.pingStreamingServer = (req, res, next) => {    
    if (config.get('hc-caas.runStreamingServer')) {
        res.sendStatus(200);
    }
    else {
        res.sendStatus(404);
    }
};



exports.putCustomImage = async (req, res, next) => {

    let args;
    if (req.get("CS-API-Arg"))
        args = JSON.parse(req.get("CS-API-Arg"));
    else
        args = {};

    let result = await server.generateCustomImage(req.params.itemid, args);  
    if (result) {        
        res.json(result);       
    }
    else {
        res.sendStatus(200);
    }
  
};


exports.putReconvert = async (req, res, next) => {

    let args;
    if (req.get("CS-API-Arg"))
        args = JSON.parse(req.get("CS-API-Arg"));
    else
        args = {};

    let result = await server.reconvert(req.params.itemid, args);  
    if (result) {        
        res.json(result);       
    }
    else {
        res.sendStatus(200);
    }
  
};

exports.getFileByType = async (req, res, next) => {
    let result = await server.get(req.params.itemid, req.params.type);

    if (result.data) {    
        return res.send(Buffer.from(result.data));
    }
    else
    {        
        res.status(404).json(result);
    }
};

exports.getFileByName = async (req, res, next) => {
    let result = await server.getByName(req.params.itemid, req.params.name);

    if (result.data) {    
        return res.send(Buffer.from(result.data));
    }
    else
    {        
        res.status(404).json(result);
    }
};

exports.getOriginal = async (req, res, next) => {

    let result = await server.getOriginal(req.params.itemid);
    if (result.data) {
        res.send(Buffer.from(result.data));
    }
    else {
        res.status(404).json(result);
    }
};

exports.getShattered = async (req, res, next) => {

    let result = await server.getShattered(req.params.itemid, req.params.name);
    if (result.data) {
        res.send(Buffer.from(result.data));
    }
    else {
        res.status(404).json(result);
    }
};

exports.getShatteredXML = async (req, res, next) => {

    let result = await server.getShatteredXML(req.params.itemid);
    if (result.data) {
        res.send(result.data.toString('ascii'));
    }
    else {
        res.status(404).json(result);
    }
};

exports.putDelete = (req, res, next) => {
    let result = server.delete(req.params.itemid); 
    if (result) {
        res.json(result);
    }
    else {
        res.sendStatus(200);   
    }
};

exports.startConversion = (req, res, next) => {

    conversionQueue.startConversion();
    res.sendStatus(200);
    
};


exports.getItems = async (req, res, next) => {
    let result = await server.getItems();
    res.json(result);    
};

exports.getUpdated = async (req, res, next) => {
    let result = await server.getLastUpdated();
    res.json(result);    
};

exports.getStreamingSession = async (req, res, next) => {

    let args;
    if (req.get("CS-API-Arg")) {
        args = JSON.parse(req.get("CS-API-Arg"));
    }

    let result = await streamingManager.getStreamingSession(args);
    res.json(result);    
};

exports.startStreamingServer = async (req, res, next) => {

    let args;
    if (req.get("CS-API-Arg")) {
        args = JSON.parse(req.get("CS-API-Arg"));
    }
    let result = await streamingServer.startStreamingServer(args);
    res.json(result); 
    
};


exports.enableStreamAccess = async (req, res, next) => {

    let items;
    let args;
    let hasNames = false;
    try {
        let json =req.get("items");
        if (json != undefined) {
            items = JSON.parse(req.get("items"));
        }        
        else {
            let json =req.get("itemnames");
            if (json != undefined) {
                items = JSON.parse(req.get("itemnames"));
                hasNames = true;
            }        
        }


        if (req.get("CS-API-Arg"))
            args = JSON.parse(req.get("CS-API-Arg"));

    }
    catch (e) {
        console.log('Error: Invalid JSON');
        res.sendStatus(200);
        return;
    }
    await streamingManager.enableStreamAccess(req.params.sessionid,items, args, hasNames);  
    res.sendStatus(200);
  
};




exports.serverEnableStreamAccess = async (req, res, next) => {
    let args;
    if (req.get("CS-API-Arg")) {
        args = JSON.parse(req.get("CS-API-Arg"));
    }
    let items  = JSON.parse(req.get("items"));

    let hasNames = false;
    if (req.get("hasNames")) {
        hasNames = JSON.parse(req.get("hasNames"));
    }

    await streamingServer.serverEnableStreamAccess(req.params.sessionid, items, args, hasNames);  
    res.sendStatus(200);
  
};



exports.getCustom = (req, res, next) => {   
    let args;
    if (req.get("CS-API-Arg")) {
        args = JSON.parse(req.get("CS-API-Arg"));
    }
    let result = server.executeCustom(args); 
    res.sendStatus(200);   
};


exports.getVersion = (req, res, next) => {
    res.send(process.env.npm_package_version);
};