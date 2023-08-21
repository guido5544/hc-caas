const conversionServer = require('../libs/conversionServer');
const modelManager = require('../libs/modelManager');
const streamingManager = require('../libs/streamingManager');
const streamingServer = require('../libs/streamingServer');

const config = require('config');
const status = require('../libs/status');

const authorization = require('../libs/authorization');

function setupAPIArgs(req) {

    let args;
    if (req.get("CS-API-Arg")) {
        args = JSON.parse(req.get("CS-API-Arg"));
    }
    else {
        args = {};
    }
    
    if (config.get('hc-caas.accessPassword') != "") {
        args.accessPassword = config.get('hc-caas.accessPassword');
    }            
    return args;
}

exports.getStatus = async (req, res, next) => {
    if (req.params.json) {
        res.json(await status.generateJSON());
    }
    else {
        res.send(await status.generateHTML());
    }
};

exports.postFileUpload = async (req, res, next) => {

    console.log("upload start");
    if (req.file == undefined)
    {
        res.json({ERROR:"No file provided for upload"});
        return;
    }
    
    let args = setupAPIArgs(req);

    if (args.itemid != undefined) {
        let data = await modelManager.append(req.file.destination, req.file.originalname, args.itemid,setupAPIArgs(req));     
        res.json(data);
    }
    else {
        let item = await modelManager.createDatabaseEntry(req.file.originalname, args);
        if (!item) {
            res.json({ERROR:"Can't Upload"});
            return;
        }
        if (args.waitUntilConversionDone) {
            await modelManager.create(item, req.file.destination, req.file.originalname, args);
        }
        else {
             modelManager.create(item, req.file.destination, req.file.originalname, args);
        }

        res.json({itemid:item.storageID});
    }

};

exports.postFileUploadArray = async (req, res, next) => {

    let data = await modelManager.createMultiple(req.files, setupAPIArgs(req));
    res.json(data);
};

exports.putCreate = async (req, res, next) => {
    if (req.get("CS-API-Arg")) {
        let data = await modelManager.createEmpty(setupAPIArgs(req));
        res.json(data);
    }
    else {
        res.json({ ERROR: "Need additional arguments" });
        return;
    }
};

exports.getUploadToken = async (req, res, next) => {

    console.log("upload token send");

    let result = await modelManager.requestUploadToken(req.params.name, setupAPIArgs(req));
    res.json(result);
};

exports.getDownloadToken = async (req, res, next) => {

    console.log("download token send");
    let result = await modelManager.requestDownloadToken(req.params.itemid,req.params.type,setupAPIArgs(req));
    res.json(result);
};

exports.getData = async (req, res, next) => {

    let data = await modelManager.getData(req.params.itemid,setupAPIArgs(req));   
    res.json(data);
};

exports.pingQueue = (req, res, next) => {    
    if (config.get('hc-caas.runConversionServer')) {
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

    let result = await modelManager.generateCustomImage(req.params.itemid, setupAPIArgs(req));  
    res.json(result);  
};


exports.putReconvert = async (req, res, next) => {

    let result = await modelManager.reconvert(req.params.itemid, setupAPIArgs(req));  
    res.json(result);  
  
};

exports.getFileByType = async (req, res, next) => {
    let result = await modelManager.get(req.params.itemid, req.params.type,setupAPIArgs(req));

    if (result.data) {    
        return res.send(Buffer.from(result.data));
    }
    else
    {        
        res.status(404).json(result);
    }
};

exports.getFileByName = async (req, res, next) => {
    let result = await modelManager.getByName(req.params.itemid, req.params.name,setupAPIArgs(req));

    if (result.data) {    
        return res.send(Buffer.from(result.data));
    }
    else
    {        
        res.status(404).json(result);
    }
};

exports.getOriginal = async (req, res, next) => {

    let result = await modelManager.getOriginal(req.params.itemid,setupAPIArgs(req));
    if (result.data) {
        res.send(Buffer.from(result.data));
    }
    else {
        res.status(404).json(result);
    }
};

exports.getShattered = async (req, res, next) => {

    let result = await modelManager.getShattered(req.params.itemid, req.params.name,setupAPIArgs(req));
    if (result.data) {
        res.send(Buffer.from(result.data));
    }
    else {
        res.status(404).json(result);
    }
};

exports.getShatteredXML = async (req, res, next) => {

    let result = await modelManager.getShatteredXML(req.params.itemid,setupAPIArgs(req));
    if (result.data) {
        res.send(result.data.toString('ascii'));
    }
    else {
        res.status(404).json(result);
    }
};

exports.putDelete = (req, res, next) => {
    let result = modelManager.deleteConversionitem(req.params.itemid,setupAPIArgs(req)); 
    if (result) {
        res.json(result);
    }
    else {
        res.sendStatus(200);   
    }
};

exports.startConversion = (req, res, next) => {

    let result = conversionServer.startConversion();
    if (!result.ERROR) {
        res.sendStatus(200);
    }
    else {
        res.sendStatus(404);
    }

};

exports.getInfo = async (req, res, next) => {
    res.json({version: process.env.caas_version});
};

exports.getItems = async (req, res, next) => {
    let result = await modelManager.getItems(setupAPIArgs(req));
    res.json(result);
};

exports.getUpdated = async (req, res, next) => {
    let result = await modelManager.getLastUpdated();
    res.json(result);
};

exports.getStreamingSession = async (req, res, next) => {
    let result = await streamingManager.getStreamingSession(setupAPIArgs(req));
    res.json(result);
};

exports.startStreamingServer = async (req, res, next) => {
    if (!config.get('hc-caas.runStreamingServer')) {
        res.sendStatus(404);
    }
    else {
        let result = await streamingServer.startStreamingServer(setupAPIArgs(req));
        res.json(result);
    }
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
    }
    catch (e) {
        res.json({ERROR:"Invalid Stream Access Tokens"});
        return;
    }
    await streamingManager.enableStreamAccess(req.params.sessionid,items, setupAPIArgs(req), hasNames);  
    res.json({SUCCESS:true});
  
};

exports.serverEnableStreamAccess = async (req, res, next) => {
    let args = setupAPIArgs(req);

    let items  = JSON.parse(req.get("items"));

    let hasNames = false;
    if (req.get("hasNames")) {
        hasNames = JSON.parse(req.get("hasNames"));
    }

    await streamingServer.serverEnableStreamAccess(req.params.sessionid, items, args, hasNames);  
    res.sendStatus(200);
  
};

exports.getCustom = (req, res, next) => {   
    let args = setupAPIArgs(req);
    modelManager.executeCustom(args); 
    res.sendStatus(200);   
};


exports.addUser = async (req, res, next) => {
    let response = await authorization.addUser(req,setupAPIArgs(req));
    res.json(response);
};

exports.generateAPIKey = async (req, res, next) => {
    let response = await authorization.generateAPIKey(req,setupAPIArgs(req));
    res.json(response);
};

exports.checkPassword = async (req, res, next) => {
    let response = await authorization.checkPassword(req,setupAPIArgs(req));
    res.json(response);
};

exports.getUserInfo = async (req, res, next) => {
    let response = await authorization.getUserInfo(req,setupAPIArgs(req));
    res.json(response);
};

exports.changeOrgName = async (req, res, next) => {
    let response = await authorization.changeOrgName(req,setupAPIArgs(req));
    res.json(response);
};


exports.retrieveInvite = async (req, res, next) => {
    let response = await authorization.retrieveInvite(req,setupAPIArgs(req));
    res.json(response);
};

exports.acceptInvite = async (req, res, next) => {
    let response = await authorization.acceptInvite(req,setupAPIArgs(req));
    res.json(response);
};

exports.getUsers = async (req, res, next) => {
    let response = await authorization.getUsers(req,setupAPIArgs(req));
    res.json(response);
};


exports.updateUser = async (req, res, next) => {
    let response = await authorization.updateUser(req,setupAPIArgs(req));
    res.json(response);
};


exports.removeUser = async (req, res, next) => {
    let response = await authorization.removeUser(req,setupAPIArgs(req));
    res.json(response);
};