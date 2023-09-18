const config = require('config');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const SessionServerItem = require('../models/sessionServerItem');
const SessionItem = require('../models/sessionItem');

const geoip = require('geoip-lite');


const fetch = require('node-fetch');

var storage;


class SessionManager {
  constructor(type) {
    if (!storage) {
      storage = require('./permanentStorage').getStorage();
    }
    this._type = type;
    this.queryServers();
  }


  async queryServers() {
    let servers = await SessionServerItem.find({ type: this._type });

    for (let i = 0; i < servers.length; i++) {
      const controller = new AbortController();
      let to = setTimeout(() => controller.abort(), 2000);

      try {
        let ip = servers[i].address;

        if (ip.indexOf(global.caas_publicip) != -1) {
          ip = "localhost" + ":" + config.get('hc-caas.port');
        }


        let res = await fetch("http://" + ip + '/caas_api/pingSessionServer/' + this._type, {
          signal: controller.signal,
          headers: { 'CS-API-Arg': JSON.stringify({ accessPassword: config.get('hc-caas.accessPassword') }) }
        });
        if (res.status == 404) {
          throw 'Session Server not found';
        }
        else {
          servers[i].lastPing = new Date();
          servers[i].pingFailed = false;
          servers[i].save();
          console.log("Session Server found:" + servers[i].address);
        }
      }
      catch (e) {

        let timeDiff = Math.abs(new Date() - streamingservers[i].lastPing);
        let diffHours = Math.ceil(timeDiff / (1000 * 60 * 60));
        if (diffHours > 24) {
          await SessionServerItem.deleteOne({ "address": servers[i].address });
          console.log("Session Server " + servers[i].address + " not reachable for more than 24 hours. Removed from database");
        }
        else {
          servers[i].pingFailed = true;
          servers[i].save();
          console.log("Could not ping session server at " + servers[i].address + ": " + e);
        }
      }
      clearTimeout(to);
    }
  }


  async getSession(args, req = null, extraCheck = true) {

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


    let servers = await Streamingserveritem.find({ type: this._type, region: config.get('hc-caas.region') });

    if (servers.length == 0) {
      return { ERROR: "No Session Server Available" };;
    }
    servers.sort(function (a, b) {
      return a.pingFailed - b.pingFailed || b.priority - a.priority || b.freeSessionSlots - a.freeSessionSlots;
    });

    let bestFitServer = servers[0];
    if (geo != "") {
      for (let i = 0; i < servers.length; i++) {
        if (geo.indexOf(servers[i].streamingRegion) != -1 && !servers[i].pingFailed) {
          bestFitServer = servers[i];
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
    console.log("Best Fit Server:" + bestFitServer.address);
    const controller = new AbortController();
    let to = setTimeout(() => controller.abort(), 6000);

    try {
      if (!args) {
        res = await fetch("http://" + ip + '/caas_api/startSession' + "/" + this._type, { method: 'PUT', signal: controller.signal });
      }
      else {
        res = await fetch("http://" + ip + '/caas_api/startSession' + "/" + this._type, { method: 'PUT', signal: controller.signal, headers: { 'CS-API-Arg': JSON.stringify(args) } });
      }
      if (res.status == 404) {
        throw 'Session Server not found';
      }
    }
    catch (e) {
      clearTimeout(to);
      console.log("Error requesting session from " + ip + ": " + e);
      bestFitServer.pingFailed = true;
      await bestFitServer.save();
      if (extraCheck) {
        return await this.getSession(args, req, false);
      }
      return { ERROR: "NO Session Server Available" };
    }
    clearTimeout(to);
    bestFitServer.pingFailed = false;
    bestFitServer.lastPing = new Date();
    await bestFitServer.save();

    let jres = await res.json();
    return jres;
  }
}


module.exports = SessionManager;