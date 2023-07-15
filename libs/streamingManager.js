const config = require('config');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const Streamingserveritem = require('../models/streamingserveritem');
const Streamingsessionitem = require('../models/streamingsessionitem');

const fetch = require('node-fetch');

let storage;

let started = false;




async function queryStreamingServers() {
  let streamingservers = await Streamingserveritem.find();

  for (let i = 0; i < streamingservers.length; i++) {
    const controller = new AbortController();
    let to = setTimeout(() => controller.abort(), 2000);
    
    try {   
      let ip;
      if (config.get('hc-caas.streamingServer.serviceIP') == streamingservers[i].address) {
          ip = "http://localhost" + ":" + config.get('hc-caas.port');
      }
      else {
        ip = streamingservers[i].address;
      }

      let res = await fetch(ip + '/caas_api/pingStreamingServer', { signal: controller.signal });
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



exports.getStreamingSession = async (args, extraCheck = true) => {
  
  if (!started) {
    return { ERROR: "Streaming Manager not started" };
  }

  console.log("geo:" + (args.geo ? args.geo : ""));

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
  if (args && args.geo) {
    for (let i = 0; i < streamingservers.length; i++) {
      if (args.geo.indexOf(streamingservers[i].streamingRegion) != -1 && !streamingservers[i].pingFailed) {
        bestFitServer = streamingservers[i];
        break;
      }
    }
  }

  let ip;
  if (config.get('hc-caas.streamingServer.serviceIP') == bestFitServer.address) {
      ip = "http://localhost" + ":" + config.get('hc-caas.port');
  }
  else {
    ip = bestFitServer.address;
  }
  let res;
  console.log("Best Fit Server:" +  bestFitServer.address);
  const controller = new AbortController();
  let to = setTimeout(() => controller.abort(), 2000);

  try {
    if (!args) {
      res = await fetch(ip + '/caas_api/startStreamingServer', { method: 'PUT',signal: controller.signal });
    }
    else {
      res = await fetch(ip + '/caas_api/startStreamingServer', { method: 'PUT', signal: controller.signal,headers: { 'CS-API-Arg': JSON.stringify(args) } });
    }
  }
  catch(e) {
    clearTimeout(to);
    console.log("Error requesting streaming session from " + ip + ": " + e);
    bestFitServer.pingFailed = true;
    await bestFitServer.save();
    if (extraCheck) {
      return await this.getStreamingSession(args,false);
    }
    return { ERROR: "NO Streaming Server Available" };
  }
  clearTimeout(to);
  bestFitServer.pingFailed = false;
  bestFitServer.lastPing = new Date();
  await bestFitServer.save();

  let jres = await res.json();

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
    let localip = await getIP();
    let ip;
    if (config.get('hc-caas.streamingServer.serviceIP') == item.serveraddress) {
      ip = "http://localhost" + ":" + config.get('hc-caas.port');
    }
    else {
      ip = item.serveraddress;
    }

    if (args) {
      await fetch(ip + '/caas_api/serverEnableStreamAccess/' + sessionid, { method: 'PUT',headers:{'CS-API-Arg': JSON.stringify(args),'items':JSON.stringify(itemids), hasNames:hasNames} });
    }
    else {
      await fetch(ip + '/caas_api/serverEnableStreamAccess/' + sessionid, { method: 'PUT',headers:{'items':JSON.stringify(itemids), hasNames:hasNames} });
    }
  }

};



async function getIP() {
  return null;
  // return new Promise((resolve, reject) => {

  //   var http = require('http');

  //   http.get({ 'host': 'api.ipify.org', 'port': 80, 'path': '/' }, function (resp) {
  //     resp.on('data', function (ip) {     
  //       resolve(new TextDecoder().decode(ip));
  //     });
  //   });
  // });
}