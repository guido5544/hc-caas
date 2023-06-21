const config = require('config');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const Streamingserveritem = require('../models/streamingserveritem');
const Streamingsessionitem = require('../models/streamingsessionitem');

const fetch = require('node-fetch');

let storage;

let started = false;


exports.start = async () => {

  storage = require('./permanentStorage').getStorage();

  setTimeout(async function () {

    
    let streamingservers = await Streamingserveritem.find();

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 2000);
    let localip = await getIP();

    for (let i = 0; i < streamingservers.length; i++) {
      try {
     
        let ip;
        if (localip == streamingservers[i].address.split(':')[0]) {
          ip = "http://localhost" + ":" + streamingservers[i].address.split(':')[1];
        }
        else {
          ip = streamingservers[i].address;
        }

        let res = await fetch(ip + '/api/pingStreamingServer', { signal: controller.signal });
        if (res.status == 404) {
          throw 'Streaming Server not found';
        }
        else {
          console.log("Streaming Server found:" + streamingservers[i].address);
        }
      }
      catch (e) {
        await Streamingserveritem.deleteOne({ "address": streamingservers[i].address });
        console.log("Could not ping streaming server at " + streamingservers[i].address + ": " + e);
      }
    }
  }, 1000);
  console.log('streaming manager started');
  started = true;
};



exports.getStreamingSession = async (args) => {
  if (!started) {
    return { ERROR: "Streaming Manager not started" };
  }

  console.log("geo:" + (args.geo ? args.geo : ""));

  let renderType = "client";
  if (args && args.renderType) {
    renderType = args.renderType;
  }
  let streamingservers = await Streamingserveritem.find({renderType: { $in: ['mixed', renderType] },region: config.get('hc-caas.region')});

  streamingservers.sort(function (a, b) {
    if (a.freeStreamingSlots > b.freeStreamingSlots) {
      return -1;
    }
    else if (a.freeStreamingSlots < b.freeStreamingSlots) {
      return 1;
    }
    return 0;
  });

  let bestFitServer = streamingservers[0];
  if (args && args.geo) {
    for (let i = 0; i < streamingservers.length; i++) {
      if (args.geo.indexOf(streamingservers[i].streamingRegion) != -1) {
        bestFitServer = streamingservers[i];
        break;
      }
    }
  }

  if (streamingservers && streamingservers.length > 0) {
    let localip = await getIP();
    let ip;
    if (localip == bestFitServer.address.split(':')[0]) {
      ip = "http://localhost" + ":" + bestFitServer.address.split(':')[1];
    }
    else {
      ip = bestFitServer.address;
    }
    let res;
    if (!args) {
       res = await fetch(ip + '/api/startStreamingServer', { method: 'PUT' });
    }
    else {
      res = await fetch(ip + '/api/startStreamingServer', { method: 'PUT', headers:{'CS-API-Arg': JSON.stringify(args)}});
    }
    let jres = await res.json();
  
    return jres;
  }
};


exports.enableStreamAccess = async (sessionid,itemids, args, hasNames = false) => {

  let item = await Streamingsessionitem.findOne({ _id:sessionid });
  if (item) {
    let localip = await getIP();
    let ip;
    if (localip == item.serveraddress.split(':')[0]) {
      ip = "http://localhost" + ":" + item.serveraddress.split(':')[1];
    }
    else {
      ip = item.serveraddress;
    }

    if (args) {
      await fetch(ip + '/api/serverEnableStreamAccess/' + sessionid, { method: 'PUT',headers:{'CS-API-Arg': JSON.stringify(args),'items':JSON.stringify(itemids), hasNames:hasNames} });
    }
    else {
      await fetch(ip + '/api/serverEnableStreamAccess/' + sessionid, { method: 'PUT',headers:{'items':JSON.stringify(itemids), hasNames:hasNames} });
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