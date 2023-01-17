const AWS = require('aws-sdk');
const fs = require('fs');
const config = require('config');
const path = require('path');


var bucket = "";

var s3 = null;

exports.initialize = () => {
    if (!s3) {

        s3 = new AWS.S3();
        bucket = config.get('hc-caas.storage.destination');
        var params = {
            Bucket: bucket
           };
        s3.getBucketLocation(params,function (err, data) {
            if (err) {
                if (config.get("hc-caas.fullErrorReporting")) {
                    console.error(err);
                }
                console.log("Fatal Error: AWS S3 not available. Have you set the AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables?\n" + err.message);
                process.exit([1]);                    
            }
            else {
                console.log("S3 Storage Initialization Successful.");
            }
        });
    }
};





readFileIntenal = (bucket,filename) => {

    return new Promise((resolve, reject) => {
        var s3Params = {
            Bucket: bucket,
            Key: filename
        };

        s3.getObject(s3Params, function (err, res) {
            if (err === null) {
                resolve(res.Body);
            } else {
                resolve(null);
            }
        });
    });
};


exports.readFile = async (filename,item) => {
    let bucket = config.get('hc-caas.storage.destination');
    if (item && item.storageAvailability) {
        for (let i=0;i<item.storageAvailability.length;i++) {
            if (item.storageAvailability[i].bucket == config.get('hc-caas.storage.destination') && !item.storageAvailability[i].inProgress) {
                break;
            }
            if (i == item.storageAvailability.length - 1) {
                bucket = item.storageAvailability[0].bucket;     
                if (config.get('hc-caas.storage.s3.replicate')) {
                    setTimeout(() => { 
                    resolveRegionReplication(item);
                    }, 1000);
                }
            }
        }
    }

    if (config.get('hc-caas.storage.s3.externalReplicate')) {
        let buffer = await readFileIntenal(config.get('hc-caas.storage.destination'), filename);
        if (!buffer && bucket != config.get('hc-caas.storage.destination')) {
            buffer = await readFileIntenal(bucket, filename);
        }
        else {
            if (bucket != config.get('hc-caas.storage.destination')) {
                item.storageAvailability.push({ bucket: config.get('hc-caas.storage.destination'), inProgress: false });
                await item.save();
            }
        }
        return buffer;
    }
    else {
        let buffer = await readFileIntenal(bucket, filename);
        return buffer;
    }

};



copyObject = (destination, source, targetname) => {
    return new Promise((resolve, reject) => {
        var params = {
            Bucket: destination,
            CopySource: source,
            Key: targetname
        };
        s3.copyObject(params, function (err, res) {
            if (err === null) {
                resolve();
            } else {
                resolve();
            }
        });
    });
};


exports.distributeToRegions = async (item) => {

    if (item.storageAvailability && item.conversionState == "SUCCESS") {
        let copyBuckets = config.get('hc-caas.storage.copyDestinations');
        for (let i=0;i<copyBuckets.length;i++) {
            let found = false;
            for (let j = 0; j < item.storageAvailability.length; j++) {
                if (item.storageAvailability[j].bucket == copyBuckets[i]) {
                    found = true;
                    break;
                }
            }
            if (found) {
                continue;
            }
            item.storageAvailability.push({ bucket: copyBuckets[i], inProgress: true });
            await item.save();
            for (let j = 0; j < item.files.length; j++) {
                await copyObject(copyBuckets[i], "/" + item.storageAvailability[0].bucket + "/" + "conversiondata" + "/" + item.storageID + "/" + item.files[j],"conversiondata" + "/" + item.storageID + "/" + item.files[j]);
            }
            item.storageAvailability[item.storageAvailability.length - 1].inProgress = false;
            item.markModified('storageAvailability');
            await item.save();
        }
    }
};


resolveRegionReplication = async (item) => {

    if (item.storageAvailability && item.conversionState == "SUCCESS") {
        for (let i = 0; i < item.storageAvailability.length; i++) {
            if (item.storageAvailability[i].bucket == config.get('hc-caas.storage.destination')) {
                return;
            }
        }
        item.storageAvailability.push({ bucket: config.get('hc-caas.storage.destination'), inProgress: true });
        await item.save();

        for (let i = 0; i < item.files.length; i++) {
            await copyObject(config.get('hc-caas.storage.destination'), "/" + item.storageAvailability[0].bucket + "/" + "conversiondata" + "/" + item.storageID + "/" + item.files[i],"conversiondata" + "/" + item.storageID + "/" + item.files[i]);
        }
        item.storageAvailability[item.storageAvailability.length - 1].inProgress = false;
        item.markModified('storageAvailability');
        await item.save();
    }
};


exports.resolveInitialAvailability = () => {
    return {bucket: config.get('hc-caas.storage.destination'), inProgress: false};
};


exports.storeFromBuffer = (data, s3target) => {
    return new Promise((resolve, reject) => {
            _storeInS3(s3target, data).then(() => {
                resolve();
            });
    });
};

exports.store = (inputfile, s3target, item) => {
    return new Promise((resolve, reject) => {
        fs.readFile(inputfile, function (err, data) {
            _storeInS3(s3target, data, item).then(() => {
                resolve();
            });
        });
    });
};


_storeInS3 = (filename, data, item) => {

    let bucket = config.get('hc-caas.storage.destination');
    if (item && item.storageAvailability) {
        bucket = item.storageAvailability[0].bucket;
    }

    return new Promise((resolve, reject) => {

        var uploadParams = { Bucket: bucket, Key: '', Body: '' };
        uploadParams.Body = data;
        uploadParams.Key = filename;
        s3.upload(uploadParams, function (err, data) {
            resolve();
            if (err) {
                console.log("Error", err);
            }
            else
                console.log(filename + " send to S3");

        });
    });

};


exports.delete = (filename) => {
    var s3Params = { Bucket: bucket, Key: '', Body: '' };
    s3Params.Key = filename;
    s3.deleteObject(s3Params);  
};


exports.requestUploadToken = async (filename, item) => {

    return await _getPresignedUrlPut(filename, item);

};


exports.requestDownloadToken = async (filename, item) => {

    
    let bucket = config.get('hc-caas.storage.destination');
    if (item && item.storageAvailability) {
        for (let i = 0; i < item.storageAvailability.length; i++) {
            if (item.storageAvailability[i].bucket == config.get('hc-caas.storage.destination')) {
                break;
            }
            if (i == item.storageAvailability.length - 1) {
                bucket = item.storageAvailability[0].bucket;
                if (config.get('hc-caas.storage.s3.replicate')) {
                    setTimeout(() => {
                        resolveRegionReplication(item);
                    }, 1000);
                }
            }
        }
    }


    if (config.get('hc-caas.storage.s3.externalReplicate')) {
        let url = await _getPresignedUrlS3(config.get('hc-caas.storage.destination'),filename);
        if (!url && bucket != config.get('hc-caas.storage.destination')) {
            url = await _getPresignedUrlS3(bucket,filename);
        }
        else {
            if (bucket != config.get('hc-caas.storage.destination')) {
                item.storageAvailability.push({ bucket: config.get('hc-caas.storage.destination'), inProgress: false });
                await item.save();
            }
        }
        return url;
    }
    else {
        let url = await _getPresignedUrlS3(bucket,filename);
        return url;
    }
};


function _getPresignedUrlPut(filename, item) {

    let bucket = config.get('hc-caas.storage.destination');
    if (item && item.storageAvailability) {
        bucket = item.storageAvailability[0].bucket;
    }

    return new Promise(async (resolve, reject) => {

        let contentType = "";
        if (path.extname(filename) == ".zip") {
            contentType = "application/x-zip-compressed";
        }
        const s3Params = {
            Bucket: bucket,
            Key: filename,
            Expires: 60 * 60 * 60,
            ContentType: contentType
        };

        try {
            s3.getSignedUrl('putObject', s3Params, function (err, data) {
                resolve(data);
            });
        } catch (error) {
            return reject(error);
        }
    });
}

function _getPresignedUrlS3(bucket,filename) {
    return new Promise(async (resolve, reject) => {

        const s3Params = {
            Bucket: bucket,
            Key: filename,
            Expires: 60 * 60 * 60,
            ContentType:null
            };

        try {
            s3.getSignedUrl('getObject', s3Params, function (err, data) {
                if (err) {
                    resolve (null);
                }
                else {
                    resolve(data);
                }
            });
        } catch (error) {
            resolve(null);
        }
    });
}
