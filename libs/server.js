const config = require('config');
const Conversionitem = require('../models/conversionitem');
const fs = require('fs');
const conversionQueue = require('./conversionqueue');
const { v4: uuidv4 } = require('uuid');

const Queueserveritem = require('../models/queueserveritem');
const fetch = require('node-fetch');

const localCache = require('./localCache');

var storage;

let lastUpdated  = new Date();

var totalConversions = 0;

var customCallback;

exports.start = async (callback) => {

  customCallback = callback;
 
  storage = require('./permanentStorage').getStorage();

  setTimeout(async function () {
    var queueservers = await Queueserveritem.find();

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 2000);

    for (let i = 0; i < queueservers.length; i++) {
      try {
        let res = await fetch("http://" + queueservers[i].address + '/api/pingQueue', { signal: controller.signal });
        if (res.status == 404) {
          throw 'Server not found';
        }
        else {
          console.log("Conversion Queue found:" + queueservers[i].address);
        }
      }
      catch (e) {
        await Queueserveritem.deleteOne({ "address": queueservers[i].address });
        console.log("Could not ping " + queueservers[i].address + ": " + e);
      }
    }
  }, 1000);
  console.log('Server started on ' + new Date());
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
      console.log("file is in cache");
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
    return ({data:blob});
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
    await storage.store(directory + "/" + itemname, "conversiondata/" + itemid + "/" + itemname,item);
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

    fs.rm(directory, { recursive: true }, (err) => {
      if (err) {
        throw err;
      }
    });

    return { itemid: itemid };
  }
  else {
    return { ERROR: "Item not found" };
  }
};

exports.requestUploadToken = async (itemname, args) => {
  if (!storage.requestUploadToken)
  {
    return {ERROR: "Not available for this storage type"};
  }

  var itemid = uuidv4();

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

  let res = await this.create(files[rootFileIndex].destination, files[rootFileIndex].originalname, args);
  let itemid = res.itemid;
  for (let i = 0; i < files.length; i++) {
    if (rootFileIndex == i) {
      continue;
    }
    await this.append(files[i].destination, files[i].originalname, itemid);
  }

  if (!skipConversion) {
    await this.reconvert(itemid, args);
  }
  return { itemid: itemid };
};


exports.create = async (directory, itemname, args) => {
  var itemid = uuidv4();

  await storage.store(directory + "/" + itemname, "conversiondata/" + itemid + "/" + itemname);

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

  if (!args.skipConversion) {
    let job = await conversionQueue.getQueue().add({ item: item });
    
    sendConversionRequest();
    if (args.waitUntilConversionDone) {
      await waitUntilConversionDone(itemid);
    }
  }

  fs.rm(directory, { recursive: true }, (err) => {
    if (err) {
      throw err;
    }
  });
  console.log("File Uploaded:" + itemname);

  return { itemid: itemid };
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



exports.delete = async (itemid, startPath) => {

  let item = await Conversionitem.findOne({ storageID: itemid });
  if (item) {
    storage.delete("conversiondata/" + item.storageID, item);
    lastUpdated = new Date();
    await Conversionitem.deleteOne({ storageID: itemid });
  }
  else {
    return {ERROR: "Item not found"};
  }
};

async function sendConversionRequest() {
  let queueservers = await Queueserveritem.find({region: config.get('hc-caas.region')});

  queueservers.sort(function (a, b) {
    if (a.freeConversionSlots > b.freeConversionSlots) {
      return -1;
    }
    else if (a.freeConversionSlots < b.freeConversionSlots) {
      return 1;
    }
    return 0;
  });

  if (queueservers && queueservers.length > 0) {
    await fetch("http://" + queueservers[0].address + '/api/startConversion', { method: 'PUT' });
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