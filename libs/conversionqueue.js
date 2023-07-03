const fs = require('fs');
const config = require('config');
const path = require('path');
const mongooseJobQueue = require('fast-mongoose-job-queue');
const unzipper = require('unzipper');
const del = require('del');
const fetch = require('node-fetch');

const Conversionitem = require('../models/conversionitem');
const Queueserveritem = require('../models/queueserveritem');


var storage;

const e = require('express');

const execFile = require('child_process').execFile;

let  converterexepath = '';


const HEimportexportexepath = './ImportExport';   

var converterpath = '';

var HEimportexportpath = '';

let tempFileDir = "E:/GitHub/conversionservice/hc-caas/tempfiles";

let simConversions = 0;
const maxConversions = config.get('hc-caas.queue.maxConversions');

var queue
if (config.get('hc-caas.region') == "") {
   queue = mongooseJobQueue(global.con, 'conversion-queue');
}
else {
  queue = mongooseJobQueue(global.con, 'conversion-queue' + '-' + config.get('hc-caas.region'));
}


let queueaddress = "";

let imageservice = null;


exports.start = async () => {

  

  storage = require('./permanentStorage').getStorage();

  queue.cleanup();
  
  let ip = config.get('hc-caas.queue.ip');

  converterpath = config.get('hc-caas.queue.converterpath');

  if (process.platform == "win32") {
    converterexepath = './converter';
  }
  else {
    converterexepath = converterpath + '/converter';
  }

  HEimportexportpath = config.get('hc-caas.queue.HEimportexportpath');
  tempFileDir = config.get('hc-caas.workingDirectory');
  if (ip == "") {
    ip = await getIP();
  }

  queueaddress = ip + ":" + config.get('hc-caas.port');

  let queueserver = await Queueserveritem.findOne({ address: queueaddress });
  if (!queueserver) {
      queueserver = new Queueserveritem({
        name: config.get('hc-caas.queue.name'),
        address: queueaddress,
        freeConversionSlots:maxConversions,
        region: config.get('hc-caas.region'),
        lastPing: new Date(),
        priority: config.get('hc-caas.queue.priority')
    });
    queueserver.save();
  }
  else
  {
    queueserver.name = config.get('hc-caas.queue.name'),
    queueserver.freeConversionSlots = maxConversions;
    queueserver.region = config.get('hc-caas.region');
    queueserver.priority =  config.get('hc-caas.queue.priority')
    queueserver.save();
  }

  if (!fs.existsSync(tempFileDir)) {
    fs.mkdirSync(tempFileDir);
  }

  if (config.get('hc-caas.queue.polling')) {
    setInterval(async function () {
      await getConversionJobFromQueue();
    }, 1000);
  }
  else
     getConversionJobFromQueue();
    
  console.log('Conversion queue running');


};

exports.getQueue = () => {
  return queue;
};

exports.startConversion = () => {
  getConversionJobFromQueue();
};

async function cleanupDir(dir, item) {
  await del(dir + item.storageID,{force: true});
}


async function getFilesFromStorage(payload) {

  let item = payload.item;
  await getFileFromStorage(payload);
  const dir = tempFileDir + "/" + item.storageID;
  
  for (let i=0;i<payload.item.files.length;i++) {
    let filename = payload.item.files[i];
    data = await storage.readFile("conversiondata/" + item.storageID + "/" + filename);
  
    if (!data) {
      return false;
    }
    fs.writeFileSync(dir + "/" + filename, data);
  }
  console.log(item.name + " downloaded from storage");
  return true;

}

async function getFileFromStorage(payload) {
  let item = payload.item;

  let data;
  if (payload.customImageCode) {

    if (path.extname(item.name) == ".scs") {
      data = await storage.readFile("conversiondata/" + item.storageID + "/" + item.name);
    }
    else {
      data = await storage.readFile("conversiondata/" + item.storageID + "/" + item.name + ".scs");
    }
  }
  else {
    data = await storage.readFile("conversiondata/" + item.storageID + "/" + item.name);
  }
  if (!data)
    return false;
  const dir = tempFileDir + "/" + item.storageID;

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  if (path.extname(item.name) == ".zip") {
    fs.writeFileSync(dir + "/" + item.name, data);
  }
  else {
    fs.writeFileSync(dir + "/" + item.name, data);
  }
  console.log(item.name + " downloaded from storage");
  return true;
}


async function conversionComplete(err, item) {

  let savedFiles = [];
  if (err != null)
    console.log(err);
  else {
    if (item.shattered == true) {
      await saveShatteredFilesInStorage(item);
    }
    else {
      const files = await readDir(tempFileDir + "/" + item.storageID);
      for (var i = 0; i < files.length; i++) {
        if ((item.name) != files[i] && files[i] != "zip") {
          savedFiles.push(files[i]);          
          await storage.store(tempFileDir + "/" + item.storageID + "/" + files[i], "conversiondata/" + item.storageID + "/" + files[i], item);
        }
      }
    }

    let founditem = await Conversionitem.findOne({ storageID: item.storageID });
    founditem.conversionState = "SUCCESS";
    founditem.updated =  new Date();
    for (let i=0;i<savedFiles.length;i++)
    {
      founditem.files.push(savedFiles[i]);
    }

    await founditem.save();
    storage.distributeToRegions(founditem);
    updateConversionStatus(founditem, savedFiles);
    cleanupDir(tempFileDir + "/", item);
  }
}

async function saveShatteredFilesInStorage(item) {
  await storage.store(tempFileDir + "/" +  item.storageID + "/shattered.xml", "conversiondata/" + item.storageID + "/shattered.xml", item);

  const files = await readDir(tempFileDir + "/" +  item.storageID + "/scs");
  for (var i = 0; i < files.length; i++) {
    await storage.store(tempFileDir + "/" +  item.storageID + "/scs/" + files[i], "conversiondata/" +  item.storageID + "/scs/" + files[i], item);

  }
}

function readDir(dir) {
  return new Promise((resolve, reject) => {

    fs.readdir(dir, function (err, files) {

      if (err == null)
        resolve(files);
    });
  });
}

async function runCustomImage(item,customImageCode) {

  const dir = tempFileDir + "/";
  let inputPath = dir + item.storageID + "/" + item.name;
  await scSpecialHandling(inputPath, dir, item, customImageCode);
}


async function runConverter(item) {

  console.log(item.name + " starting conversion at " + new Date());
  let inputPath;
  const dir = tempFileDir + "/";

  if (item.startPath == undefined && path.extname(item.name) == ".zip") {
    cleanupDir(dir, item);
    let founditem = await Conversionitem.findOne({ storageID: item.storageID });

    founditem.conversionState = "ERROR - Specify startPath with ZIP";
    founditem.updated =  new Date();
    await founditem.save();
    updateConversionStatus(founditem);

    return;
  }

  if (item.startPath == undefined || path.extname(item.name) != ".zip")
    inputPath = dir + item.storageID + "/" + item.name;
  else
    inputPath = dir + item.storageID + "/zip/" + item.startPath;


  if (item.shattered == true) {
    execFile(converterexepath, ['--license', config.get('hc-caas.license'),
      '--input', inputPath,
      '--prepare_shattered_scs_parts', dir + item.storageID + "/scs",
      '--prepare_shattered_xml', dir + item.storageID + "/" + "shattered.xml"], {
      cwd: converterpath
    }, async function (err, data) {
      if (err == null) {
        console.log(data);
        conversionComplete(err, item);
      }
      else {
        console.log(err);
        console.log(data);
        cleanupDir(tempFileDir + "/", item);
        let founditem = await Conversionitem.findOne({ storageID: item.storageID });
        founditem.conversionState = "ERROR - Conversion Error";
        founditem.updated = new Date();
        await founditem.save();
        updateConversionStatus(founditem);
      }
    });

  }
  else {
    if (item.name.indexOf(".scs") != -1 || item.name.indexOf(".scz") != -1) {
        await scSpecialHandling(inputPath, dir, item);
    }
    else {
      if (!GLTFSpecialHandling(inputPath, dir, item)) {

        let commandLine = setupCommandLine(inputPath, dir, item);
        execFile(converterexepath, commandLine, {
          cwd: converterpath
        }, async function (err, data) {
          if (err == null) {
            if (fs.existsSync(dir + item.storageID + "/" + item.name + "_.scz")) {
              fs.renameSync( dir + item.storageID + "/" + item.name + "_.scz",dir + item.storageID + "/" + item.name + ".scz");
            }
            //      console.log(data);
            console.log(item.name + " converted successfully at " + new Date());
            conversionComplete(err, item);
          }
          else {
            if (config.get("hc-caas.fullErrorReporting")) {
              console.error(err);
              console.error(data);
            }
            console.error("ERROR: Could not convert file. Check license and converterpath in config. Are required redistributables installed?");
            cleanupDir(tempFileDir + "/", item);
            let founditem = await Conversionitem.findOne({ storageID: item.storageID });
            founditem.conversionState = "ERROR - Conversion Error";
            founditem.updated = new Date();
            await founditem.save();
            updateConversionStatus(founditem);
          }

        });
      }
    }
  }
}

function getCommandLineArgument(arg, commandLine) {
  if (!commandLine)
    return -1;
  for (let i = 0; i < commandLine.length; i++) {
    if (commandLine[i].indexOf(arg) != -1) {
      return i;
    }
  }
  return -1;
}

async function scSpecialHandling(inputPath, dir, item, customImageCode) {


  if (!item.conversionCommandLine || getCommandLineArgument('--output_png', item.conversionCommandLine) != -1 || customImageCode) {

    if (item.name.indexOf(".scz") == -1) {
      if (!imageservice) {
        imageservice = require('ts3d-hc-imageservice');
        await imageservice.start({ viewerPort: config.get('hc-caas.queue.imageServicePort') });
      }

      let width = 640, height = 480;
      let resIndex = getCommandLineArgument('--output_png_resolution', item.conversionCommandLine);
      if (resIndex != -1) {
        let res = item.conversionCommandLine[resIndex + 1].split("x");
        width = res[0];
        height = res[1];

      }

      let api_arg = { size: { width: width, height: height }, code: customImageCode };

      let data = await imageservice.generateImage(inputPath, api_arg);

      fs.writeFileSync(dir + item.storageID + "/" + item.name + ".png", Buffer.from(data));
    }

  }
  conversionComplete(null, item);
}

function GLTFSpecialHandling(inputPath, dir, item) {
  let found = getCommandLineArgument('--output_glb', item.conversionCommandLine);
  if (found != -1) {
    commandLine = [inputPath, dir + item.storageID + "/" + item.name + "." + "glb","GLB",config.get('hc-caas.license'),
      config.get('hc-caas.queue.HEInstallPath') ];
  }
  else {
     found = getCommandLineArgument('--output_fbx', item.conversionCommandLine);  
     if (found != -1) {
      commandLine = [inputPath, dir + item.storageID + "/" + item.name + "." + "fbx","FBX",config.get('hc-caas.license'),
      config.get('hc-caas.queue.HEInstallPath') ];
     }
  }

  if (found == -1) {
    return false;
  }

  execFile(HEimportexportexepath, commandLine, {
    cwd: HEimportexportpath
  }, async function (err, data) {
    if (err == null) {
      //      console.log(data);
      console.log("converted:" + inputPath);
      conversionComplete(err, item);
    }
    else {
      console.log(err);
      console.log(data);
      cleanupDir(tempFileDir + "/", item);
      let founditem = await Conversionitem.findOne({ storageID: item.storageID });
      founditem.conversionState = "ERROR - Conversion Error";
      founditem.updated = new Date();
      await founditem.save();
      updateConversionStatus(founditem);
    }

  });
  return true;


}

function setupCommandLine(inputPath, dir, item) {
  let hidden = 'false';
  if (inputPath.indexOf(".ifc")) {
    hidden = 'true';
  }
  let commandLine;

  if (!path.isAbsolute(inputPath)) {
    inputPath = path.join(process.cwd(), inputPath);
    dir = path.join(process.cwd(), dir);
  }

  if (!item.conversionCommandLine) {
    commandLine = ['--license', config.get('hc-caas.license'),
      '--input', inputPath,
      '--output_scs', dir + item.storageID + "/" + item.name + ".scs",
      '--output_sc', dir + item.storageID + "/" + item.name + "_",
      '--output_png', dir + item.storageID + "/" + item.name + ".png",
      '--background_color', "1,1,1",
      '--sc_export_attributes', 'true',
      '--ifc_import_openings', 'false',
      '--import_hidden_objects', hidden,
      '--png_transparent_background', '1',
      '--sc_create_scz', 'true',
      '--sc_compress_scz', '1'];
  }
  else {  
    
    commandLine = ['--license', config.get('hc-caas.license')];

    let hasInput = false;
    for (let i = 0; i < item.conversionCommandLine.length; i += 2) {
      

      commandLine.push(item.conversionCommandLine[i]);

      if (item.conversionCommandLine[i] == "--input") {
        hasInput = true;
        commandLine.push(tempFileDir + "/" + item.storageID + "/" + item.conversionCommandLine[i + 1]);

      }

      if (item.conversionCommandLine[i].indexOf("--output_") != -1) {
        let type = item.conversionCommandLine[i].split("_")[1];
        if (item.conversionCommandLine[i+1] != null && item.conversionCommandLine[i+1] != "") {
          commandLine.push(dir + item.storageID + "/" + item.conversionCommandLine[i+1]);
        }
        else {
          if (type == "sc") {
            commandLine.push(dir + item.storageID + "/" + item.name);
          } else {
            commandLine.push(dir + item.storageID + "/" + item.name + "." + type);
          }
        }
      }
      else {
        commandLine.push(item.conversionCommandLine[i + 1]);
      }
    }
    if (!hasInput) {
      commandLine.push("--input");
      commandLine.push(inputPath);
    }
      

  }
  return commandLine;
}

async function runZip(item) {

  const dir = tempFileDir + "/";
  fs.createReadStream(dir + item.storageID + "/" + item.name)
    .pipe(unzipper.Extract({ path: dir + item.storageID + "/" + "zip" })).on('finish', () => {
      console.log(item.name + " unzipped");
      runConverter(item);
    }
    ).on('error', async (err) => {
      console.log(err);
      cleanupDir(item);
      let founditem = await Conversionitem.findOne({ storageID: item.storageID });
      founditem.conversionState = "ERROR - Unzip Error";
      founditem.updated =  new Date();
      await founditem.save();
      updateConversionStatus(founditem);

    });
}

async function sendToWebHook(item, files) {
  if (item.webhook) {
    try {

      await fetch(item.webhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id: item.storageID, conversionState: item.conversionState, files: files })
      });
    } catch (e) {
      console.log("Error: Webhook failed");
    }
  }
}

async function getConversionJobFromQueue() {
  if (simConversions < maxConversions) {
    const job = await queue.checkout(120);

    if (job != null) {

      let res;
      if (job.payload.item.multiConvert) {
          res = await getFilesFromStorage(job.payload);
      }
      else {
        res = await getFileFromStorage(job.payload);
      }
      if (!res) {
        queue.ack(job.ack);
        return;
      }

      simConversions++;
      updateFreeConversionSlots();

      queue.ack(job.ack);

      if (job.payload.customImageCode) {
        runCustomImage(job.payload.item, job.payload.customImageCode);
      }
      else {

        if (path.extname(job.payload.item.name) == ".zip") {
          runZip(job.payload.item);
        }
        else {
          runConverter(job.payload.item);
        }
      }
    }
  }
  else {
    if (!config.get('hc-caas.queue.polling')) {
      setTimeout(async function () {
        await getConversionJobFromQueue();
      }, 1000);
    }
  }
}

async function updateConversionStatus(item, files) {
  sendToWebHook(item, files);
  simConversions--;
  console.log("Conversions Running: " + simConversions);
  updateFreeConversionSlots();
  getConversionJobFromQueue();
}

async function updateFreeConversionSlots()
{
  let queueserver = await Queueserveritem.findOne({ address: queueaddress });
  queueserver.freeConversionSlots = maxConversions - simConversions;
  await queueserver.save();
}

async function getIP() {
  return null;
  // return new Promise((resolve, reject) => {

  //   var http = require('http');

  //   http.get({ 'host': 'api.ipify.org', 'port': 80, 'path': '/' }, function (resp) {
  //     resp.on('data', function (ip) {
  //       resolve(ip);
  //       //        console.log("My public IP address is: " + ip);
  //     });
  //   });
  // });
}