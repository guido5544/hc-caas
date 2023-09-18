const config = require('config');



const SessionManager = require('./sessionManager');
const SessionServer = require('./sessionServer');

var sessionPluginManagers = [];
var sessionPluginServers = [];




exports.start = async () => {
    let sessionPluginInfo = config.get('hc-caas.sessionPlugins');
    for (let i = 0; i < sessionPluginInfo.length; i++) {
      if (sessionPluginInfo[i].isServer) {
        sessionPluginServers[sessionPluginInfo[i].type] =  new SessionServer(sessionPluginInfo[i].type,sessionPluginInfo[i].serverInfo);
      }
      if (sessionPluginInfo[i].isManager) {
        sessionPluginManagers[sessionPluginInfo[i].type] =  new SessionManager(sessionPluginInfo[i].type);
      }
    }

};

exports.serverExists = (type) => {
    return sessionPluginServers[type] != undefined;
}