const express = require('express');
const apiController = require('../controllers/api');
const router = express.Router();


router.get('/info', apiController.getInfo);
router.get('/status/:json?', apiController.getStatus);
router.get('/updated', apiController.getUpdated);

router.post('/upload', apiController.postFileUpload);
router.post('/uploadArray', apiController.postFileUploadArray);
router.get('/data/:storageID', apiController.getData);
router.get('/file/:storageID/:type', apiController.getFileByType);
router.get('/fileByName/:storageID/:name', apiController.getFileByName);
router.get('/original/:storageID', apiController.getOriginal);
router.put('/create/', apiController.putCreate);
router.put('/customImage/:storageID', apiController.putCustomImage);
router.put('/reconvert/:storageID', apiController.putReconvert);
router.put('/delete/:storageID', apiController.putDelete);
router.get('/items', apiController.getItems);
router.get('/uploadToken/:name/:size', apiController.getUploadToken);
router.get('/downloadToken/:storageID/:type', apiController.getDownloadToken);

router.get('/shattered/:storageID/:name', apiController.getShattered);
router.get('/shatteredXML/:storageID', apiController.getShatteredXML);

router.get('/streamingSession', apiController.getStreamingSession);
router.put('/enableStreamAccess/:sessionid', apiController.enableStreamAccess);

router.get('/hcVersion', apiController.getHCVersion);

module.exports = router;