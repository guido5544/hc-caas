const fs = require('fs');
const path = require('path');
const del = require('del');
const config = require('config');




let storageDirectory;

if (config.has('hc-caas.storage.destination') && config.get('hc-caas.storage.destination') != "") {
    storageDirectory = config.get('hc-caas.storage.destination');
}
else {
    storageDirectory = config.get('hc-caas.workingDirectory') + "/permanentStorage";
}

console.log("Filesystem Storage Initalized at: " + storageDirectory);

exports.readFile = (filename) => {
    return new Promise((resolve, reject) => {

        fs.readFile(storageDirectory + "/" + filename, function (err, data) {
            if (err) 
                resolve(null);
            else
                resolve(data);
        });

    });
};


exports.resolveRegionReplication = async (item) => {
    return;
};


exports.distributeToRegions = async (item) => {
    return;
};

exports.resolveInitialAvailability = () => {
    return undefined;
};

exports.createSymLink = (filename, target) => {
    return new Promise((resolve, reject) => {

        fs.symlink(storageDirectory + "/" + filename,target,"file", function (err) {
            if (err)
                resolve(null);
            else
                resolve();
        });

    });
};

exports.createSymLinkDir = (filename, target) => {
    return new Promise((resolve, reject) => {

        fs.symlink(filename,target,"junction", function (err) {
            if (err)
                resolve(null);
            else
                resolve();
        });

    });
};





exports.delete = (filename) => {
    del(storageDirectory + "/" + filename,{force: true});
};





exports.storeFromBuffer = (data, s3target) => {
    return new Promise((resolve, reject) => {     
            _storeInFS(s3target, data).then(() => {
                resolve();
            });
    });
};



exports.store = (inputfile, s3target) => {
    return new Promise((resolve, reject) => {
        fs.readFile(inputfile, function (err, data) {
            if (err) {
                console.log(err);
                reject({ERROR: "Error reading file " + inputfile});
                return;
            }
            _storeInFS(s3target, data).then(() => {
                resolve();
            });
        });
    });
};


_makeAllDirectories = (dirs) => {
    fs.mkdirSync(dirs,{ recursive: true });
};

_storeInFS = (storagepath, data) => {
    return new Promise((resolve, reject) => {

        const filepath = path.dirname(storagepath);
        const name = path.basename(storagepath);
        var dir = storageDirectory + "/" + filepath;
        _makeAllDirectories(dir);

        fs.writeFile(dir + "/" + name, data, (err) => {
            if (err)
                console.log(err);
            else {
                console.log(name + " send to FS");
                resolve();
            }
        });
    });

};


