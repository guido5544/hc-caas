const fs = require('fs');
const config = require('config');
const path = require('path');
const del = require('del');
const { readdir, stat,writeFile } = require('fs/promises');

var cachedFiles = [];
var cachePath;
var maxSize = 0;
var totalSize = 0;

const dirSize = async directory => {
    const files = await readdir( directory );
    const stats = files.map( file => stat( path.join( directory, file ) ) );
  
    return ( await Promise.all( stats ) ).reduce( ( accumulator, { size } ) => accumulator + size, 0 );
};

(async () => {

  
    if (config.has('hc-caas.localCache.directory') && config.get('hc-caas.localCache.directory') != "") {
        cachePath = config.get('hc-caas.localCache.directory');
    }
    else {
        cachePath = config.get('hc-caas.workingDirectory') + "/localCache";

        if (!fs.existsSync(cachePath)) {
            fs.mkdirSync(cachePath);
        }
    }

    maxSize = config.get('hc-caas.localCache.maxSize');


   

    const files = await readdir(cachePath);
    for (var i = 0; i < files.length; i++) {
        let size = await dirSize(cachePath + "/" + files[i]) / 1024 / 1024;
        totalSize += size;
        const sfiles = await readdir(cachePath + "/" + files[i]);
        let stats = await stat(cachePath + "/" + files[i]);
        cachedFiles[files[i]] = { "size": size, "files": sfiles, timestamp: stats.birthtimeMs };
    }
    cleanup();


})();


exports.isInCache = (storageID, name) => {

    if (cachedFiles[storageID] != undefined) {
        for (let i=0;i<cachedFiles[storageID].files.length;i++) {
            if (cachedFiles[storageID].files[i] == name) {
                cachedFiles[storageID].timestamp = Date.now(); 
                return true;
            }
        }
    }
    return false;
};



exports.createSymLink = (storageID,name, target) => {
    return new Promise((resolve, reject) => {

        fs.symlink(cachePath + "/" + storageID + "/" +  name,target,"file", function (err) {
            if (err)
                resolve(null);
            else
                resolve();
        });

    });
};


exports.readFile = (storageID,name) => {
    return new Promise((resolve, reject) => {

        fs.readFile(cachePath + "/" + storageID + "/" +  name, function (err, data) {
            if (err)
                resolve(null);
            else
                resolve(data);
        });

    });
};

exports.cacheFile = async (storageID, name, data) => {

    if (maxSize > 0) {
        let cpath = cachePath + "/" + storageID;
        if (!fs.existsSync(cpath)) {
            fs.mkdirSync(cpath);
        }

        await writeFile(cpath + "/" + name, data);
        if (cachedFiles[storageID] != undefined) {
            totalSize -= cachedFiles[storageID].size;
        }
        let size = dirSize(cpath) / 1024 / 1024;
        totalSize += size;
        if (cachedFiles[storageID] == undefined) {
            cachedFiles[storageID] = { "size": size, "files": [name], timestamp: Date.now() };
        }
        else {
            cachedFiles[storageID].size = size;
            cachedFiles[storageID].files.push(name);
            cachedFiles[storageID].timestamp = Date.now();
        }
        cleanup();
    }
};


async function cleanup() {
    if (totalSize > maxSize) {
        let clist = [];
        for (let i in cachedFiles) {
            clist.push({storageID: i, file:cachedFiles[i]});          
        }
        clist.sort(function (a, b) {
            return a.file.timestamp - b.file.timestamp;
        });

        for (let i=0;i<clist.length;i++) {
            let storageID = clist[i].storageID;
            totalSize -= cachedFiles[storageID].size;
            delete cachedFiles[storageID];
            await del(cachePath + "/" + storageID,{force: true});
            if (totalSize <= maxSize)
                break;
        }
    }
}