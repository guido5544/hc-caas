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
          <td>${row.lastAccess}</td>
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
                <th>Last Access</th>
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


function formatDate(date) {
  return new Date(date).toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

exports.generateJSON = async () => {
  let servers = [];
  let streamingservers = await Streamingserveritem.find();
  streamingservers.sort((a, b) => {
    let nameA = a.name ? a.name.toUpperCase() : a.address; // ignore case
    let nameB = b.name ? b.name.toUpperCase() : b.address; // ignore case

    if (nameA < nameB) {
      return -1;
    }
    if (nameA > nameB) {
      return 1;
    }
  });

  for (let i = 0; i < streamingservers.length; i++) {
    servers.push({
      servername: streamingservers[i].name ? streamingservers[i].name : "", serveraddress: streamingservers[i].address,
      type: 'Streaming Server', status: (streamingservers[i].pingFailed ? 'Offline' : 'Online'), lastAccess: formatDate(streamingservers[i].lastPing)
    });
  }

  let queueservers = await Queueserveritem.find();

  queueservers.sort((a, b) => {
    let nameA = a.name ? a.name.toUpperCase() : a.address; // ignore case
    let nameB = b.name ? b.name.toUpperCase() : b.address; // ignore case

    if (nameA < nameB) {
      return -1;
    }
    if (nameA > nameB) {
      return 1;
    }
  });

  for (let i = 0; i < queueservers.length; i++) {

    servers.push({
      servername: queueservers[i].name ? queueservers[i].name : "", serveraddress: queueservers[i].address, type: 'Conversion Server', status: (queueservers[i].pingFailed ? 'Offline' : 'Online'),
      lastAccess: formatDate(queueservers[i].lastPing)
    });
  }
  return servers;
};


exports.generateHTML = async () => {

  let json = await this.generateJSON();

  return makeHTML(json);

};
