const Streamingserveritem = require('../models/streamingserveritem');
const Queueserveritem = require('../models/queueserveritem');

  // Generate the HTML page
 const makeHTML = (serverData) => {
    const tableRows = serverData.map(row => {
      return `
        <tr>
          <td>${row.servername}</td>
          <td>${row.serveraddress}</td>
          <td>${row.type}</td>
          <td>${row.status}</td>
        </tr>
      `;
    }).join('');
  
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Server Status</title>
        </head>
        <body>
          <table>
            <thead>
              <tr>
                <th>Server Name</th>
                <th>Server Address</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </body>
      </html>
    `;
  
    return html;
  };


exports.generateJSON = async () => {
  let servers = [];
  let streamingservers = await Streamingserveritem.find();
  for (let i = 0; i < streamingservers.length; i++) {
    servers.push({ servername: streamingservers[i].name ? streamingservers[i].name : "", serveraddress: streamingservers[i].address, 
      type: 'Streaming Server', status: (streamingservers[i].pingFailed ? 'Offline' : 'Online') });
  }

  var queueservers = await Queueserveritem.find();
  for (let i = 0; i < queueservers.length; i++) {

    servers.push({ servername: queueservers[i].name ?  queueservers[i].name : "",  serveraddress: queueservers[i].address, type: 'Conversion Server', status: (queueservers[i].pingFailed ? 'Offline' : 'Online') });
  }
  return servers;
};


exports.generateHTML = async () => {

  let json = await this.generateJSON();

  return makeHTML(json);

};
