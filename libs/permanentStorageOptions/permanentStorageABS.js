const { BlobServiceClient } = require("@azure/storage-blob");
const { DefaultAzureCredential } = require('@azure/identity');
const fs = require('fs');
const config = require('config');
const path = require('path');


var bucket = "";

var blobServiceClient = null;

exports.initialize = () => {
    if (!blobServiceClient) {
        bucket = config.get('hc-caas.storage.destination');
        if (config.get('hc-caas.storage.ABS.accountName') != "") {
            blobServiceClient = new BlobServiceClient(
                'https://${' + config.get('hc-caas.storage.ABS.accountName') + '}.blob.core.windows.net',
                new DefaultAzureCredential()
            );
        }
        else {

            blobServiceClient = BlobServiceClient.fromConnectionString(
                config.get('hc-caas.storage.ABS.connectionString')
            );
        }
        console.log("ABS Storage initialized.");
    }
};


readFileIntenal = async (bucket,filename) => {

    const containerClient = blobServiceClient.getContainerClient(bucket);
    const blockBlobClient = containerClient.getBlockBlobClient(filename);
    const downloadBlockBlobResponse = await blockBlobClient.downloadToBuffer(0);
    return (downloadBlockBlobResponse);

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
                if (config.get('hc-caas.storage.replicate')) {
                    setTimeout(() => { 
                    resolveRegionReplication(item);
                    }, 1000);
                }
            }
        }
    }

    if (config.get('hc-caas.storage.externalReplicate')) {
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



copyObject = async (destination, source, targetname) => {

    const sourceContainerClient = blobServiceClient.getContainerClient(source); 
    const destinationContainerClient = blobServiceClient.getContainerClient(destination);  

    const sourceBlobClient = await sourceContainerClient.getBlobClient(sourceBlobName);
    const destinationBlobClient = await destinationContainerClient.getBlobClient(destinationBlobName);

    const copyPoller = await destinationBlobClient.beginCopyFromURL(sourceBlobClient.url);
    console.log('start copy from A to B');

    // wait until done
    await copyPoller.pollUntilDone();


    // return new Promise((resolve, reject) => {
    //     var params = {
    //         Bucket: destination,
    //         CopySource: source,
    //         Key: targetname
    //     };
    //     s3.copyObject(params, function (err, res) {
    //         if (err === null) {
    //             resolve();
    //         } else {
    //             resolve();
    //         }
    //     });
    // });
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


exports.storeFromBuffer = (data, target) => {
    return new Promise((resolve, reject) => {
            _storeInAzure(target, data).then(() => {
                resolve();
            });
    });
};

exports.store = (inputfile, target, item) => {
    
    return new Promise((resolve, reject) => {
        fs.readFile(inputfile, function (err, data) {
            _storeInAzure(target, data, item).then(() => {
                resolve();
            });
        });
    });
};


_storeInAzure = (filename, data, item) => {

    let bucket = config.get('hc-caas.storage.destination');
    if (item && item.storageAvailability) {
        bucket = item.storageAvailability[0].bucket;
    }


    const containerClient = blobServiceClient.getContainerClient(bucket);
    const blockBlobClient = containerClient.getBlockBlobClient(filename);
    return blockBlobClient.upload(data, data.length);

};

exports.delete = async (name, item) => {

    const options = {
        deleteSnapshots: 'include' // or 'only'
      };

    if (item && item.storageAvailability) {
        for (let i = 0; i < item.storageAvailability.length; i++) {

            const containerClient = blobServiceClient.getContainerClient(item.storageAvailability[i].bucket);
            const blockBlobClient = await containerClient.getBlockBlobClient(name);
            await blockBlobClient.delete(options);
        }
    }
    else {
        const containerClient = blobServiceClient.getContainerClient(bucket);
        const blockBlobClient = await containerClient.getBlockBlobClient(name);
        await blockBlobClient.delete(options);
    }
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
                if (config.get('hc-caas.storage.replicate')) {
                    setTimeout(() => {
                        resolveRegionReplication(item);
                    }, 1000);
                }
            }
        }
    }


    if (config.get('hc-caas.storage.externalReplicate')) {
        let url = await _getPresignedUrlABS(config.get('hc-caas.storage.destination'),filename);
        if (!url && bucket != config.get('hc-caas.storage.destination')) {
            url = await _getPresignedUrlABS(bucket,filename);
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
        let url = await _getPresignedUrlABS(bucket,filename);
        return url;
    }
};


async function _getPresignedUrlPut(filename, item) {

    // let bucket = config.get('hc-caas.storage.destination');
    // if (item && item.storageAvailability) {
    //     bucket = item.storageAvailability[0].bucket;
    // }

    // return new Promise(async (resolve, reject) => {

    //     let contentType = "";
    //     if (path.extname(filename) == ".zip") {
    //         contentType = "application/x-zip-compressed";
    //     }
    //     const s3Params = {
    //         Bucket: bucket,
    //         Key: filename,
    //         Expires: 60 * 60 * 60,
    //         ContentType: contentType
    //     };

    //     try {
    //         s3.getSignedUrl('putObject', s3Params, function (err, data) {
    //             resolve(data);
    //         });
    //     } catch (error) {
    //         return reject(error);
    //     }
    // });
}

async function _getPresignedUrlABS(bucket,filename) {
    // return new Promise(async (resolve, reject) => {

    //     const s3Params = {
    //         Bucket: bucket,
    //         Key: filename,
    //         Expires: 60 * 60 * 60,
    //         ContentType:null
    //         };

    //     try {
    //         s3.getSignedUrl('getObject', s3Params, function (err, data) {
    //             if (err) {
    //                 resolve (null);
    //             }
    //             else {
    //                 resolve(data);
    //             }
    //         });
    //     } catch (error) {
    //         resolve(null);
    //     }
    // });
}
