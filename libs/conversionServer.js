const fs = require('fs');
const config = require('config');
const path = require('path');
const mongooseJobQueue = require('fast-mongoose-job-queue');
const del = require('del');
const fetch = require('node-fetch');

const Conversionitem = require('../models/conversionitem');
const Queueserveritem = require('../models/queueserveritem');

const authorization = require('./authorization');

const decompress = require('decompress');

var storage;

const e = require('express');

const execFile = require('child_process').execFile;

let  converterexepath = '';


const HEimportexportexepath = './ImportExport';   


var HEimportexportpath = '';

let tempFileDir = "E:/GitHub/conversionservice/hc-caas/tempfiles";

let simConversions = 0;
const maxConversions = config.get('hc-caas.conversionServer.maxConversions');

var queue
if (config.get('hc-caas.region') == "") {
   queue = mongooseJobQueue(global.con, 'conversion-queue');
}
else {
  queue = mongooseJobQueue(global.con, 'conversion-queue' + '-' + config.get('hc-caas.region'));
}


let queueaddress = "";

let imageservice = null;


function getConverterExePath(converterpath) {

  if (process.platform == "win32") {
    return './converter';
  }
  else {
    return  converterpath + '/converter';
  }
}

function getConverterPath(item) {

  let cp = config.get('hc-caas.conversionServer.converterpath');
  if (!Array.isArray(cp)) {
     return cp;
  }

  if (!item.hcVersion || cp.length == 1) {
    return cp[0].path;
  }

  for (let i=0;i<cp.length;i++) {
    if (cp[i].version == item.hcVersion) {
      return cp[i].path;
    }
  }
  return "";
}

exports.start = async () => {

  storage = require('./permanentStorage').getStorage();

  queue.cleanup();
  
  let ip = global.caas_publicip;

  HEimportexportpath = config.get('hc-caas.conversionServer.HEimportexportpath');
  tempFileDir = config.get('hc-caas.workingDirectory');
  
  queueaddress = ip + ":" + config.get('hc-caas.port');

  let queueserver = await Queueserveritem.findOne({ address: queueaddress });
  if (!queueserver) {
      queueserver = new Queueserveritem({
        name: config.get('hc-caas.conversionServer.name'),
        address: queueaddress,
        freeConversionSlots:maxConversions,
        region: config.get('hc-caas.region'),
        lastPing: new Date(),
        pingFailed: false,
        priority: config.get('hc-caas.conversionServer.priority')
    });
    queueserver.save();
  }
  else
  {
    queueserver.name = config.get('hc-caas.conversionServer.name'),
    queueserver.freeConversionSlots = maxConversions;
    queueserver.region = config.get('hc-caas.region');
    queueserver.priority =  config.get('hc-caas.conversionServer.priority')    
    queueserver.lastPing = new Date();
    queueserver.pingFailed = false;
    queueserver.save();
  }

  if (!fs.existsSync(tempFileDir)) {
    fs.mkdirSync(tempFileDir);
  }

  if (config.get('hc-caas.conversionServer.polling')) {
    setInterval(async function () {
      await getConversionJobFromQueue();
    }, 1000);
  }
  else
     getConversionJobFromQueue();
    
  console.log('Conversion Server started');


};

exports.getQueue = () => {
  return queue;
};

exports.startConversion = () => {
  if (config.get('hc-caas.runConversionServer') == false) {
    return {ERROR:"Conversion Server not running"};
  }
  else {
    getConversionJobFromQueue();
    return {OK:"Conversion Server started"};
  }
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
  if (!data) {
    return false;
  }

  const dir = tempFileDir + "/" + item.storageID;
  const outputdir = tempFileDir + "/" + item.storageID + "/output";


  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  if (!fs.existsSync(outputdir)) {
    fs.mkdirSync(outputdir);
  }

  fs.writeFileSync(dir + "/" + item.name, data);
  
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
      const files = await readDir(tempFileDir + "/" + item.storageID + "/output");
      for (var i = 0; i < files.length; i++) {
        if ((item.name) != files[i] && files[i] != "zip") {
                 
          let res = await storage.store(tempFileDir + "/" + item.storageID + "/output/" + files[i], "conversiondata/" + item.storageID + "/" + files[i], item);
          if (!res.ERROR) {
            savedFiles.push(files[i]);
          } 
        }
      }
    }

    let founditem = await Conversionitem.findOne({ storageID: item.storageID });
    authorization.conversionComplete(founditem);
    
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
    queue.cleanup();
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

    let converterPath = getConverterPath(item);
  
  if (item.shattered == true) {
    execFile(getConverterExePath(converterPath), ['--license', config.get('hc-caas.license'),
      '--input', inputPath,
      '--prepare_shattered_scs_parts', dir + item.storageID + "/scs",
      '--prepare_shattered_xml', dir + item.storageID + "/" + "shattered.xml"], {
      cwd: converterPath
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
    if (config.get("hc-caas.conversionServer.allowSCSConversion") && (item.name.indexOf(".scs") != -1 || item.name.indexOf(".scz") != -1)) {
        await scSpecialHandling(inputPath, dir, item);
    }
    else {
      if (!GLTFSpecialHandling(inputPath, dir, item)) {
        let commandLine = setupCommandLine(inputPath, dir, item);
        execFile(getConverterExePath(converterPath), commandLine, {
          cwd: converterPath
        }, async function (err, data) {
          if (err == null) {
            if (fs.existsSync(dir + item.storageID + "/output/" + item.name + "_.scz")) {
              fs.renameSync( dir + item.storageID + "/output/" + item.name + "_.scz",dir + item.storageID + "/output/" + item.name + ".scz");
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
            let etemp = err.message.split("\n");
            if (etemp.length) {
              let etext = ""
              for (let i = 1; i < etemp.length; i++) {
                etext += etemp[i] + "\n";
              }

              founditem.detailedError = etext;
            }
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
        await imageservice.start({ viewerPort: config.get('hc-caas.conversionServer.imageServicePort'),
        puppeteerArgs:["--no-sandbox"] });
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

      fs.writeFileSync(dir + item.storageID + "/output/" + item.name + ".png", Buffer.from(data));
    }

  }
  conversionComplete(null, item);
}

function GLTFSpecialHandling(inputPath, dir, item) {
  let found = getCommandLineArgument('--output_glb', item.conversionCommandLine);
  if (found != -1) {
    commandLine = [inputPath, dir + item.storageID + "/" + item.name + "." + "glb","GLB",config.get('hc-caas.license'),
      config.get('hc-caas.conversionServer.HEInstallPath') ];
  }
  else {
     found = getCommandLineArgument('--output_fbx', item.conversionCommandLine);  
     if (found != -1) {
      commandLine = [inputPath, dir + item.storageID + "/" + item.name + "." + "fbx","FBX",config.get('hc-caas.license'),
      config.get('hc-caas.conversionServer.HEInstallPath') ];
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

  if (config.get('hc-caas.licenseFile') != "") {
    commandLine = ['--license_file', config.get('hc-caas.licenseFile')];
  }
  else {
    commandLine = ['--license', config.get('hc-caas.license')];
  }

  if (!path.isAbsolute(inputPath)) {
    inputPath = path.join(process.cwd(), inputPath);
    dir = path.join(process.cwd(), dir);
  }

  if (!item.conversionCommandLine) {      
      commandLine.push('--input', inputPath,
      '--output_scs', dir + item.storageID + "/output/" + item.name + ".scs",
      '--output_sc', dir + item.storageID + "/output/" + item.name + "_",
      '--output_png', dir + item.storageID + "/output/" + item.name + ".png",
      '--background_color', "1,1,1",
      '--sc_export_attributes', 'true',
      '--ifc_import_openings', 'false',
      '--import_hidden_objects', hidden,
      '--png_transparent_background', '1',
      '--sc_create_scz', 'true',
      '--sc_compress_scz', '1');
    
  }
  else {  
    
    let hasInput = false;

    for (let i = 0; i < item.conversionCommandLine.length; i += 2) {
      
      if (i==0 && item.conversionCommandLine[0] == "*") {
        commandLine.push('--input', inputPath,
        '--output_scs', dir + item.storageID + "/output/" + item.name + ".scs",
        '--output_sc', dir + item.storageID + "/output/" + item.name + "_",
        '--output_png', dir + item.storageID + "/output/" + item.name + ".png",
        '--background_color', "1,1,1",
        '--sc_export_attributes', 'true',
        '--ifc_import_openings', 'false',
        '--import_hidden_objects', hidden,
        '--png_transparent_background', '1',
        '--sc_create_scz', 'true',
        '--sc_compress_scz', '1');
        hasInput = true;
        i++;
      }

      commandLine.push(item.conversionCommandLine[i]);

      if (item.conversionCommandLine[i] == "--input") {
        hasInput = true;
        commandLine.push(tempFileDir + "/" + item.storageID + "/" + item.conversionCommandLine[i + 1]);

      }
      else if (item.conversionCommandLine[i] == "--xml_settings") {     
        commandLine.push(tempFileDir + "/" + item.storageID + "/" + item.conversionCommandLine[i + 1]);
      }
      else if (item.conversionCommandLine[i].indexOf("--output_") != -1) {
        let type = item.conversionCommandLine[i].split("_")[1];
        if (item.conversionCommandLine[i+1] != null && item.conversionCommandLine[i+1] != "") {
          commandLine.push(dir + item.storageID + "/output/" + item.conversionCommandLine[i+1]);
        }
        else {
          if (type == "sc") {
            commandLine.push(dir + item.storageID + "/output/" + item.name);
          } else {
            commandLine.push(dir + item.storageID + "/output/" + item.name + "." + type);
          }
        }
      }
      else if (item.conversionCommandLine[i].indexOf("--prepare_shattered_xml") != -1) {
        if (item.conversionCommandLine[i+1] != null && item.conversionCommandLine[i+1] != "") {
          commandLine.push(dir + item.storageID + "/output/" + item.conversionCommandLine[i+1]);
        }
        else {
            commandLine.push(dir + item.storageID + "/output/" + item.name + "." + "xml");
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

  try {
    await decompress(dir + item.storageID + "/" + item.name, dir + item.storageID + "/" + "zip");
    console.log(item.name + " unzipped");
    runConverter(item);
    return;
  }
  catch (err) {

      console.log(err);
      cleanupDir(item);
      let founditem = await Conversionitem.findOne({ storageID: item.storageID });
      founditem.conversionState = "ERROR - Unzip Error";
      founditem.updated =  new Date();
      await founditem.save();
      updateConversionStatus(founditem);

  };
}

async function sendToWebHook(item, files) {
  if (item.webhook) {
    try {
      
      let webhookip = item.webhook;
      if (webhookip.indexOf(global.caas_publicip) != -1) {
        let s = item.webhook.split(":");
        webhookip = "http://localhost" + ":" + s[2];
      }


      await fetch(webhookip, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id: item.storageID, name: item.name, conversionState: item.conversionState, files: files })
      });
    } catch (e) {
      console.log("Error: Webhook failed:" + item.webhook);
    }
  }
}


async function getConversionJobFromQueue() {
  if (simConversions < maxConversions) {    
    const job = await queue.checkout(5);   
    if (job != null) {

      if (job.payload.name && job.payload.name != config.get('hc-caas.conversionServer.name')) {
        console.log("Job not for this server");    
        getConversionJobFromQueue();
        return;
      }

      queue.ack(job.ack);
      let res;
      if (job.payload.item.multiConvert) {
          res = await getFilesFromStorage(job.payload);
      }
      else {
        res = await getFileFromStorage(job.payload);
      }
      if (!res) {       
        return;
      }

      simConversions++;
      updateFreeConversionSlots();

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
    else {
      const jobs = await queue.get();
      for (let i=0;i<jobs.length;i++) {
        if (!jobs[i].deleted && (!jobs[i].payload.name || jobs[i].payload.name == config.get('hc-caas.conversionServer.name'))) {
          setTimeout(async function () {
            await getConversionJobFromQueue();
          }, 1000);
          break;
        }
      }

    }
  }
  else {
    if (!config.get('hc-caas.conversionServer.polling')) {
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