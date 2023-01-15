const express = require('express');
const apiController = require('../controllers/api');
const router = express.Router();

router.get('/pingStreamingServer', apiController.pingStreamingServer);
router.put('/startStreamingServer', apiController.startStreamingServer);
router.put('/serverEnableStreamAccess/:sessionid', apiController.serverEnableStreamAccess);


module.exports = router;