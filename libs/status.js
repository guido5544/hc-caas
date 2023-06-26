const Streamingserveritem = require('../models/streamingserveritem');
const Queueserveritem = require('../models/queueserveritem');

  // Generate the HTML page
 const generateHTML2 = (serverData) => {
    const tableRows = serverData.map(row => {
      return `
        <tr>
          <td>${row.servername}</td>
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


  exports.generateHTML = async () => {

    let servers = [];
    let streamingservers = await Streamingserveritem.find();
    for (let i = 0; i < streamingservers.length; i++) {
        servers.push({ servername: streamingservers[i].address, type: 'Streaming Server', status: 'Online' });
    }

    var queueservers = await Queueserveritem.find();
    for (let i = 0; i < queueservers.length; i++) {
        servers.push({ servername: queueservers[i].address, type: 'Queue Server', status: 'Online' });
    }

    return generateHTML2(servers);

  };
