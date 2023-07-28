const path = require('path');
const express = require('express');
const apiController = require('../controllers/api');
const router = express.Router();


router.get('/info', apiController.getInfo);
router.post('/upload', apiController.postFileUpload);
router.post('/uploadArray', apiController.postFileUploadArray);
router.get('/data/:itemid', apiController.getData);
router.get('/file/:itemid/:type', apiController.getFileByType);
router.get('/fileByName/:itemid/:name', apiController.getFileByName);
router.get('/original/:itemid', apiController.getOriginal);
router.put('/create/', apiController.putCreate);
router.put('/customImage/:itemid', apiController.putCustomImage);
router.put('/reconvert/:itemid', apiController.putReconvert);
router.put('/delete/:itemid', apiController.putDelete);

router.get('/items', apiController.getItems);
router.get('/updated', apiController.getUpdated);

router.get('/custom', apiController.getCustom);




router.get('/uploadToken/:name', apiController.getUploadToken);
router.get('/downloadToken/:itemid/:type', apiController.getDownloadToken);

router.get('/shattered/:itemid/:name', apiController.getShattered);
router.get('/shatteredXML/:itemid', apiController.getShatteredXML);


router.get('/streamingSession', apiController.getStreamingSession);
router.put('/enableStreamAccess/:sessionid', apiController.enableStreamAccess);
router.get('/version', apiController.getVersion);

router.get('/status/:json?', apiController.getStatus);

module.exports = router;