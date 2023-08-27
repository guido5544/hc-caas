const config = require('config');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const Streamingserveritem = require('../models/streamingserveritem');
const Streamingsessionitem = require('../models/streamingsessionitem');

const geoip = require('geoip-lite');


const fetch = require('node-fetch');

let storage;

let started = false;




async function queryStreamingServers() {
  let streamingservers = await Streamingserveritem.find();

  for (let i = 0; i < streamingservers.length; i++) {
    const controller = new AbortController();
    let to = setTimeout(() => controller.abort(), 2000);
    
    try {   
      let ip = streamingservers[i].address;
    
      if (ip.indexOf(global.caas_publicip) != -1) {
        ip = "localhost" + ":" + config.get('hc-caas.port');
      }


      let res = await fetch("http://" + ip + '/caas_api/pingStreamingServer', { signal: controller.signal,
      headers: { 'CS-API-Arg': JSON.stringify({accessPassword:config.get('hc-caas.accessPassword') }) }});
      if (res.status == 404) {
        throw 'Streaming Server not found';
      }
      else {
        streamingservers[i].lastPing = new Date();
        streamingservers[i].pingFailed = false;
        streamingservers[i].save();
        console.log("Streaming Server found:" + streamingservers[i].address);
      }
    }
    catch (e) {
      
      let timeDiff = Math.abs(new Date() - streamingservers[i].lastPing);
      let diffHours = Math.ceil(timeDiff / (1000 * 60 * 60));
      if (diffHours > 24) {
        await Streamingserveritem.deleteOne({ "address": streamingservers[i].address });
        console.log("Streaming Server " + streamingservers[i].address + " not reachable for more than 24 hours. Removed from database");
      }
      else {
        streamingservers[i].pingFailed = true;
        streamingservers[i].save();
        console.log("Could not ping streaming server at " + streamingservers[i].address + ": " + e);
      }
    }
    clearTimeout(to);
  }
}

exports.start = async () => {

  storage = require('./permanentStorage').getStorage();

  setTimeout(async function () {
    await queryStreamingServers();  
  }, 1000);

  setInterval(async function () {
    await queryStreamingServers();
  }, 1000 * 60 * 60);

  
  console.log('streaming manager started');
  started = true;
};



exports.getStreamingSession = async (args, req = null, extraCheck = true) => {
  
  if (!started) {
    return { ERROR: "Streaming Manager not started" };
  }

  let geo = "";
  if (args && args.geo && args.geo != "") {
    geo = args.geo;
  }
  else if (req && config.get('hc-caas.determineGeoFromRequest')) {
    let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    if (ip.substr(0, 7) == "::ffff:") {
      ip = ip.substr(7)
    }
    geo = geoip.lookup(ip);
    if (geo) {
      geo = geo.timezone;
    }
    if (!geo) {
      geo = ""
    }
  }

  console.log("geo:" + geo);

  let renderType = "client";
  if (args && args.renderType) {
    renderType = args.renderType;
  }
  let streamingservers = await Streamingserveritem.find({renderType: { $in: ['mixed', renderType] },region: config.get('hc-caas.region')});

  if (streamingservers.length == 0) {
    return { ERROR: "No Streaming Server Available" };;
  }
  streamingservers.sort(function (a, b) {
    return a.pingFailed - b.pingFailed || b.priority - a.priority || b.freeStreamingSlots - a.freeStreamingSlots;
  });

  let bestFitServer = streamingservers[0];
  if (geo != "") {
    for (let i = 0; i < streamingservers.length; i++) {
      if (geo.indexOf(streamingservers[i].streamingRegion) != -1 && !streamingservers[i].pingFailed) {
        bestFitServer = streamingservers[i];
        break;
      }
    }
  }

  let ip;
  ip = bestFitServer.address

  if (ip.indexOf(global.caas_publicip) != -1) {
    ip = "localhost" + ":" + config.get('hc-caas.port');
  }

  let res;
  console.log("Best Fit Server:" +  bestFitServer.address);
  const controller = new AbortController();
  let to = setTimeout(() => controller.abort(), 2000);

  try {
    if (!args) {
      res = await fetch("http://" + ip + '/caas_api/startStreamingServer', { method: 'PUT',signal: controller.signal });
    }
    else {
      res = await fetch("http://" + ip + '/caas_api/startStreamingServer', { method: 'PUT', signal: controller.signal,headers: { 'CS-API-Arg': JSON.stringify(args) } });
    }
    if (res.status == 404) {
      throw 'Streaming Server not found';
    }
  }
  catch(e) {
    clearTimeout(to);
    console.log("Error requesting streaming session from " + ip + ": " + e);
    bestFitServer.pingFailed = true;
    await bestFitServer.save();
    if (extraCheck) {
      return await this.getStreamingSession(args,req,false);
    }
    return { ERROR: "NO Streaming Server Available" };
  }
  clearTimeout(to);
  bestFitServer.pingFailed = false;
  bestFitServer.lastPing = new Date();
  await bestFitServer.save();

  let jres = await res.json();
  jres.renderType = bestFitServer.renderType;
  return jres;
};


exports.enableStreamAccess = async (sessionid,itemids, args, hasNames = false) => {

  let item;
  try {
    item = await Streamingsessionitem.findOne({ _id:sessionid });
  }
  catch (e) {
    console.log(e);
    return;
  }

  if (item) {
    ip = item.serveraddress;
    if (ip.indexOf(global.caas_publicip) != -1) {
      ip = "localhost" + ":" + config.get('hc-caas.port');
    }

    let sares;
    try {
      if (args) {
        sares = await fetch("http://" + ip + '/caas_api/serverEnableStreamAccess/' + sessionid, { method: 'PUT', headers: { 'CS-API-Arg': JSON.stringify(args), 'items': JSON.stringify(itemids), hasNames: hasNames } });
      }
      else {
        sares = await fetch("http://" + ip + '/caas_api/serverEnableStreamAccess/' + sessionid, { method: 'PUT', headers: { 'items': JSON.stringify(itemids), hasNames: hasNames } });
      }
    }
    catch (e) {
      return {ERROR: "Error enabling stream access"};
    }
    return await sares.json();
  }
  return {ERROR: "Error enabling stream access"};

};