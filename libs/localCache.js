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


exports.isInCache = (itemid, name) => {

    if (cachedFiles[itemid] != undefined) {
        for (let i=0;i<cachedFiles[itemid].files.length;i++) {
            if (cachedFiles[itemid].files[i] == name) {
                cachedFiles[itemid].timestamp = Date.now(); 
                return true;
            }
        }
    }
    return false;
};



exports.createSymLink = (itemid,name, target) => {
    return new Promise((resolve, reject) => {

        fs.symlink(cachePath + "/" + itemid + "/" +  name,target,"file", function (err) {
            if (err)
                resolve(null);
            else
                resolve();
        });

    });
};


exports.readFile = (itemid,name) => {
    return new Promise((resolve, reject) => {

        fs.readFile(cachePath + "/" + itemid + "/" +  name, function (err, data) {
            if (err)
                resolve(null);
            else
                resolve(data);
        });

    });
};

exports.cacheFile = async (itemid, name, data) => {

    if (maxSize > 0) {
        let cpath = cachePath + "/" + itemid;
        if (!fs.existsSync(cpath)) {
            fs.mkdirSync(cpath);
        }

        await writeFile(cpath + "/" + name, data);
        if (cachedFiles[itemid] != undefined) {
            totalSize -= cachedFiles[itemid].size;
        }
        let size = dirSize(cpath) / 1024 / 1024;
        totalSize += size;
        if (cachedFiles[itemid] == undefined) {
            cachedFiles[itemid] = { "size": size, "files": [name], timestamp: Date.now() };
        }
        else {
            cachedFiles[itemid].size = size;
            cachedFiles[itemid].files.push(name);
            cachedFiles[itemid].timestamp = Date.now();
        }
        cleanup();
    }
};


async function cleanup() {
    if (totalSize > maxSize) {
        let clist = [];
        for (let i in cachedFiles) {
            clist.push({itemid: i, file:cachedFiles[i]});          
        }
        clist.sort(function (a, b) {
            return a.file.timestamp - b.file.timestamp;
        });

        for (let i=0;i<clist.length;i++) {
            let itemid = clist[i].itemid;
            totalSize -= cachedFiles[itemid].size;
            delete cachedFiles[itemid];
            await del(cachePath + "/" + itemid,{force: true});
            if (totalSize <= maxSize)
                break;
        }
    }
}