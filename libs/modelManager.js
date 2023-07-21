const config = require('config');
const Conversionitem = require('../models/conversionitem');
const fs = require('fs');
const conversionQueue = require('./conversionServer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const Queueserveritem = require('../models/queueserveritem');
const fetch = require('node-fetch');

const localCache = require('./localCache');

var storage;

let lastUpdated  = new Date();

var totalConversions = 0;

var customCallback;

async function purgeFiles() {
  let files = await Conversionitem.find();

  for (let i = 0; i < files.length; i++) {
    if (files[i].conversionState != "SUCCESS") {
      let timeDiff = Math.abs(new Date() - files[i].updated);
      let diffHours = Math.ceil(timeDiff / (1000 * 60 * 60));
      if (diffHours > 24) {
          exports.deleteConversionitem(files[i].storageID);
      }
    }
  }
}

async function refreshServerAvailability() {
  var queueservers = await Queueserveritem.find();

  for (let i = 0; i < queueservers.length; i++) {
    const controller = new AbortController();
    let to = setTimeout(() => controller.abort(), 2000);

    try {
      let res = await fetch("http://" + queueservers[i].address + '/caas_api/pingQueue', { signal: controller.signal, 
        headers: { 'CS-API-Arg': JSON.stringify({accessPassword:config.get('hc-caas.accessPassword') }) } });
      if (res.status == 404) {
        throw "Could not ping Conversion Server " + queueservers[i].address;
      }
      else {
        console.log("Conversion Server found:" + queueservers[i].address);
        queueservers[i].lastPing = new Date();
        queueservers[i].pingFailed = false;
        queueservers[i].save();
      }
    }
    catch (e) {
      let timeDiff = Math.abs(new Date() - queueservers[i].lastPing);
      queueservers[i].pingFailed = true;
      queueservers[i].save();
      let diffHours = Math.ceil(timeDiff / (1000 * 60 * 60));
      if (diffHours > 24) {
        await Queueserveritem.deleteOne({ "address": queueservers[i].address });
        console.log("Conversion Server " + queueservers[i].address + " not reachable for more than 24 hours. Removed from database");
      }
      else {
        console.log("Could not ping Conversion Server " + queueservers[i].address + ": " + e);
      }
    }
    clearTimeout(to);
  }
}

exports.start = async (callback) => {

  customCallback = callback;
 
  storage = require('./permanentStorage').getStorage();

  setTimeout(async function () {
    await refreshServerAvailability();
  }, 1000);

  setInterval(async function () {
    await refreshServerAvailability();
  }, 1000 * 60 * 60);


  if (config.get('hc-caas.modelManager.purgeFiles')) {
    await purgeFiles();
    setInterval(async function () {
      await purgeFiles();
    }, 1000 * 60 * 60 * 24);
  }
    
  console.log('Model Manager started');
};


exports.getData = async (itemid) => {
  let item = await Conversionitem.findOne({ storageID: itemid });
  if (item)
  {
    let returnItem = JSON.parse(JSON.stringify(item));
    returnItem.__v = undefined;
    returnItem._id = undefined;
    returnItem.storageID = undefined;
    return (returnItem);
  }
  else
  {
    return {ERROR: "Item not found"};
  }
};


exports.requestDownloadToken = async (itemid,type) => {
  if (!storage.requestDownloadToken)
  {
    return {ERROR: "Not available for this storage type"};
  }
  let item = await Conversionitem.findOne({ storageID: itemid });
  if (item) {
    let token = await storage.requestDownloadToken("conversiondata/" + item.storageID + "/" + item.name + "." + type, item);
    return { token: token, itemid: itemid };
  }
  else
  {
    return {ERROR: "Item not found"};
  }
};

async function readFileWithCache(itemid, name, item) {
  if (name.indexOf(".scs") != -1) {
    if (localCache.isInCache(itemid, name)) {
      console.log("file loaded from cache");
      const data = await localCache.readFile(itemid, name);
      return data;
    }
    else {
      const data = await storage.readFile("conversiondata/" + itemid + "/" + name, item);
      localCache.cacheFile(itemid, name, data);
      return data;
    }
  }
  else {
    return await storage.readFile("conversiondata/" + itemid + "/" + name, item);
  }
}

exports.get = async (itemid,type) => {
  let item = await Conversionitem.findOne({ storageID: itemid });
  if (item) {
    let blob;

    if (item.name.indexOf("." + type) != -1) {
      blob = await readFileWithCache(item.storageID,item.name, item);
    }
    else {
      blob = await readFileWithCache(item.storageID,item.name + "." + type, item);
    }
    if (!blob) {
      return { ERROR: "File not found" };
    }
    else {
      return ({data:blob});
    }
  }
  else
  {
    return {ERROR: "Item not found"};
  }
};


exports.getByName = async (itemid,name) => {
  let item = await Conversionitem.findOne({ storageID: itemid });
  if (item) {
    let blob = await storage.readFile("conversiondata/" + item.storageID + "/" + name);
    return ({data:blob});
  }
  else
  {
    return {ERROR: "Item not found"};
  }
};

exports.getShattered = async (itemid, name) => {
  let item = await Conversionitem.findOne({ storageID: itemid });
  if (item) {
    let blob = await storage.readFile("conversiondata/" + item.storageID + "/scs/" + name);
    return ({ data: blob });
  }
  else {
    return { ERROR: "Item not found" };
  }
};

exports.getShatteredXML = async (itemid) => {
  let item = await Conversionitem.findOne({ storageID: itemid });
  if (item) {
    let blob = await storage.readFile("conversiondata/" + item.storageID + "/shattered.xml");
    return ({ data: blob });
  }
  else {
    return { ERROR: "Item not found" };
  }
};


exports.getOriginal = async (itemid) => {
  let item = await Conversionitem.findOne({ storageID: itemid });
  if (item) {
    let blob = await storage.readFile("conversiondata/" + item.storageID + "/" + item.name);
    return ({ data: blob });
  }
  else {
    return { ERROR: "Item not found" };
  }
};


exports.appendFromBuffer = async (buffer, itemname, itemid) => {
  let item = await Conversionitem.findOne({ storageID: itemid });
  if (item) {
    await storage.storeFromBuffer(buffer, "conversiondata/" + itemid + "/" + itemname, item);
    let newfile = true;
    for (let i = 0; i < item.files.length; i++) {
      if (item.files[i] == itemname) {
        newfile = false;
        break;
      }
    }
    if (newfile) {
      item.files.push(itemname);
    }
    item.updated = new Date();
    await item.save();
    return { itemid: itemid };
  }
  else {
    return { ERROR: "Item not found" };
  }
};

exports.append = async (directory, itemname, itemid) => {
  let item = await Conversionitem.findOne({ storageID: itemid });
  if (item) {
    if (directory) {
      await storage.store(directory + "/" + itemname, "conversiondata/" + itemid + "/" + itemname, item);
    }
    let newfile = true;
    for (let i = 0; i < item.files.length; i++) {
      if (item.files[i] == itemname) {
        newfile = false;
        break;
      }
    }
    if (newfile) {
      item.files.push(itemname);
    }
    item.updated = new Date();
    await item.save();

    if (directory) {
      fs.rm(directory, { recursive: true }, (err) => {
        if (err) {
          throw err;
        }
      });
    }

    return { itemid: itemid };
  }
  else {
    return { ERROR: "Item not found" };
  }
};

exports.requestUploadToken = async (itemname, args) => {
  var itemid;
  if (!storage.requestUploadToken) {
    return { ERROR: "Not available for this storage type" };
  }

  if (args && args.itemid != undefined) {
    let data = await this.append(null, itemname, args.itemid);
    itemid = args.itemid;
  }
  else {

    itemid = uuidv4();

    let startState = "UPLOADING";
    const item = new Conversionitem({
      name: itemname,
      storageID: itemid,
      conversionState: startState,
      updated: new Date(),
      created: new Date(),
      webhook: args.webhook,
      storageAvailability: storage.resolveInitialAvailability(),
    });
    item.save();
  }

  let token = await storage.requestUploadToken("conversiondata/" + itemid + "/" + itemname);
  return { token: token, itemid: itemid };
};


exports.createMultiple = async (files, args) => {

  let skipConversion = false;
  if (args.skipConversion) {
    skipConversion = true;
  }
  args.skipConversion = true;
  args.multiConvert = true;

  let rootFileIndex = 0;
  if (args.rootFile) {
    for (let i = 0; i < files.length; i++) {
      if (files[i].originalname == args.rootFile) {
        rootFileIndex = i;
        break;
      }
    }
  }

  let item = await this.createDatabaseEntry(files[rootFileIndex].originalname, args);
  await this.create(item, files[rootFileIndex].destination, files[rootFileIndex].originalname, args);
  let itemid = item.storageID;
  let proms= [];
  for (let i = 0; i < files.length; i++) {
    if (rootFileIndex == i) {
      continue;
    }
    proms.push(this.append(files[i].destination, files[i].originalname, itemid));
  }

  await Promise.all(proms);
  if (!skipConversion) {
    await this.reconvert(itemid, args);
  }
  return { itemid: itemid };
};



exports.createDatabaseEntry = async (itemname, args) => {

  let itemid = uuidv4();
  let startState = "PENDING";

  if (args.skipConversion)
    startState = "SUCCESS";
  const item = new Conversionitem({
    name: itemname,
    storageID: itemid,
    startPath: args.startPath,
    conversionState: startState,
    shattered: args.processShattered,
    updated: new Date(),
    created: new Date(),
    webhook: args.webhook,
    conversionCommandLine: args.conversionCommandLine,
    storageAvailability: storage.resolveInitialAvailability()
  });
  await item.save();
  return item;
};



exports.convertSingle = async (inpath,outpath,type, inargs) => {

  let args = {};
  if (inargs) {
    args = inargs;
  }
 
  let filename = path.basename(inpath);
  let item = await this.createDatabaseEntry(filename, args);

  try {
    await storage.store(inpath, "conversiondata/" + item.storageID + "/" + filename);
  }
  catch (err) {
    this.deleteConversionitem(item.storageID);
    return err;
  }
  await conversionQueue.getQueue().add({ item: item });
    
  sendConversionRequest();
  await waitUntilConversionDone(item.storageID);
  
  let res = await this.get(item.storageID,type);
  
  this.deleteConversionitem(item.storageID);
  
  if (res.ERROR) {
    return res;
  }
  else {
    if (outpath) {
      fs.writeFileSync(outpath, res.data);
    }
    return { itemid: item.storageID, buffer:res.data};
  }
};



exports.create = async (item, directory, itemname, args) => {
 

  await storage.store(directory + "/" + itemname, "conversiondata/" + item.storageID + "/" + itemname);
 
  if (!args.skipConversion) {
    await conversionQueue.getQueue().add({ item: item });
    
    sendConversionRequest();
    if (args.waitUntilConversionDone) {
      await waitUntilConversionDone(item.storageID);
    }
  }

  fs.rm(directory, { recursive: true }, (err) => {
    if (err) {
      throw err;
    }
  });
  console.log("File Uploaded:" + itemname);

};


exports.createEmpty = async (args) => {
  
  var itemid = uuidv4();

  let startState = "PENDING";
  if (args.skipConversion) {
    startState = "SUCCESS";
  }
  const item = new Conversionitem({
    name: args.itemname,
    storageID: itemid,
    startPath: args.startPath,
    conversionState: startState,
    shattered: args.processShattered,
    updated: new Date(),
    created: new Date(),
    webhook: args.webhook,
    streamLocation:"",
    conversionCommandLine: args.conversionCommandLine,
    storageAvailability: storage.resolveInitialAvailability()
  });
  
  await item.save();

  return { itemid: itemid };
};



exports.generateCustomImage = async (itemid, args) => {

  if (!itemid)
  {
    return {ERROR: "Itemid not specified"};
  }
  let item = await Conversionitem.findOne({ storageID: itemid });

  if (item) {
    item.conversionState = "PENDING";
    
    if (args.conversionCommandLine)
    {
      item.conversionCommandLine = args.conversionCommandLine;
    }
   
    item.updated = new Date();
    await item.save();
    await conversionQueue.getQueue().add({ item: item, customImageCode: args.customImageCode });
    sendConversionRequest();
  }
  else {
    return {ERROR: "Item not found"};
  }
};


exports.reconvert = async (itemid, args) => {

  if (!itemid)
  {
    return {ERROR: "Itemid not specified"};
  }
  let item = await Conversionitem.findOne({ storageID: itemid });

  if (item) {
    item.conversionState = "PENDING";

    
    if (args.multiConvert) {
      item.multiConvert = true;
    }

    if (args.startPath)
    {
      item.startPath = args.startPath;
    }
    if (args.conversionCommandLine)
    {
      item.conversionCommandLine = args.conversionCommandLine;
    }
    if (args.processShattered)
    {
      item.shattered = args.processShattered;
    }

    item.updated = new Date();
    await item.save();

    
    if (args.overrideItem) {
      item.name = args.overrideItem;
    }
   
    await conversionQueue.getQueue().add({ item: item });
    sendConversionRequest();

    if (args.waitUntilConversionDone) {
      await waitUntilConversionDone(itemid);
      totalConversions++;
      console.log("File " + item.name + " with storageID " + itemid + " converted at " + new Date());   
      console.log("Total Conversions:" + totalConversions);
    }
  }
  else {
    return {ERROR: "Item not found"};
  }
};

function waitUntilConversionDone(itemid) {
  return new Promise((resolve, reject) => {
    let waitInterval = setInterval(async () => {
      let item = await Conversionitem.findOne({ storageID: itemid });
      if (item.conversionState == "SUCCESS" || item.conversionState.indexOf("ERROR") != -1) {
        clearInterval(waitInterval);
        resolve();
      }
    }, 1000);
  });
}



exports.deleteConversionitem = async (itemid) => {

  let item = await Conversionitem.findOne({ storageID: itemid });
  if (item) {
    console.log("Deleting item: " + itemid + " " + item.name);
    storage.delete("conversiondata/" + item.storageID, item);
    lastUpdated = new Date();
    await Conversionitem.deleteOne({ storageID: itemid });
  }
  else {
    return {ERROR: "Item not found"};
  }
};

async function sendConversionRequest() {
  let queueservers = await Queueserveritem.find({ region: config.get('hc-caas.region') });
  

  queueservers.sort(function (a, b) {
    return  a.pingFailed - b.pingFailed || b.priority - a.priority || b.freeConversionSlots - a.freeConversionSlots;

  });

  if (queueservers && queueservers.length > 0) {
    for (let i = 0; i < queueservers.length; i++) {
      const controller = new AbortController();
      let to = setTimeout(() => controller.abort(), 2000);
      
      if (queueservers[i].freeConversionSlots > 0) {
        try {
          let res = await fetch("http://" + queueservers[i].address + '/caas_api/startConversion', { method: 'PUT',signal: controller.signal,
          headers: { 'CS-API-Arg': JSON.stringify({accessPassword:config.get('hc-caas.accessPassword') }) } });
          if (res.status == 404) {
            throw 'Conversion Server not found';
          }
        }
        catch (e) {
          console.log("Error sending conversion request to " + queueservers[0].address + ": " + e);
          queueservers[i].pingFailed = true;
          queueservers[i].save();
          continue;
        }
        queueservers[i].lastPing = new Date();
        queueservers[i].pingFailed = false;
        queueservers[i].save();
        break;
      }
      clearTimeout(to);
    }
  }
}


exports.getItems = async () => {
  let models = await Conversionitem.find();

  let cleanedModels = [];

  for (let i = 0; i < models.length; i++) {
    let returnItem = JSON.parse(JSON.stringify(models[i]));
    returnItem.__v = undefined;
    returnItem._id = undefined;
    cleanedModels.push(returnItem);
  }
  return { "itemarray": cleanedModels };
};


exports.getLastUpdated = async () => {
  let lastUpdatedRecord = await Conversionitem.findOne().sort({updated: -1});
  if (lastUpdatedRecord && lastUpdatedRecord.updated > lastUpdated)
  {
    return {"lastUpdated":lastUpdatedRecord.updated};
  }
  else
  {
    return {"lastUpdated":lastUpdated};
  }
};

exports.executeCustom =  (args) => {

  if (customCallback)
  {
    customCallback(args);
  }
}