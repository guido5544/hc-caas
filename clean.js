const fs = require('fs');
const path = require('path');

const del = require('del');



const config = require('config');


function readDir(dir) {
    return new Promise((resolve, reject) => {
  
      fs.readdir(dir, function (err, files) {
  
        if (err == null)
          resolve(files);
      });
    });
  }



let content = fs.readFileSync("idfile.txt", 'utf8');  
let ids = content.split(',');

let idhash = [];
for (let i=0;i<ids.length;i++) {
    idhash[ids[i]] = true;
}

(async () => {

    config.get('hc-caas.workingDirectory');
    const files = await readDir(config.get('hc-caas.workingDirectory') + "/" + "permanentStorage" + "/" + "conversiondata");

    for (let i=0;i<files.length;i++) {
         if (!idhash[files[i]]) {
             del(config.get('hc-caas.workingDirectory') + "/" + "permanentStorage" + "/" + "conversiondata" + "/" + files[i],{force: true});           
         }
    }

})();


