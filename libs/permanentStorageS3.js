const AWS = require('aws-sdk');
const fs = require('fs');
const config = require('config');
const path = require('path');


var bucket = "";

var s3 = null;

exports.initialize = () => {
    if (!s3) {

        s3 = new AWS.S3();
        bucket = config.get('hc-caas.storage.s3.bucket');
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

exports.readFile = (filename,item) => {
    let bucket = config.get('hc-caas.storage.s3.bucket');
    if (item && item.storageAvailability) {
        for (let i=0;i<item.storageAvailability.length;i++) {
            if (item.storageAvailability[i] == config.get('hc-caas.storage.s3.bucket')) {
                break;
            }
            if (i == item.storageAvailability.length - 1) {
                bucket = item.storageAvailability[0];                    
            }
        }
    }
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



exports.resolveInitialAvailability = () => {
    return config.get('hc-caas.storage.s3.bucket');
};


exports.storeFromBuffer = (data, s3target) => {
    return new Promise((resolve, reject) => {
            _storeInS3(s3target, data).then(() => {
                resolve();
            });
    });
};

exports.store = (inputfile, s3target) => {
    return new Promise((resolve, reject) => {
        fs.readFile(inputfile, function (err, data) {
            _storeInS3(s3target, data).then(() => {
                resolve();
            });
        });
    });
};


_storeInS3 = (filename, data) => {
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


exports.requestUploadToken = async (filename) => {

    return await _getPresignedUrlPut(filename);

};


exports.requestDownloadToken = async (filename) => {

    return await _getPresignedUrlGet(filename);

};


function _getPresignedUrlPut(filename) {
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


function _getPresignedUrlGet(filename) {
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
                    return reject(err);
                }
                resolve(data);
            });
        } catch (error) {
            return reject(error);
        }
    });
}