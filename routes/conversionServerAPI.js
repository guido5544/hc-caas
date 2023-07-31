const express = require('express');
const apiController = require('../controllers/api');
const router = express.Router();

router.get('/pingQueue', apiController.pingQueue);
router.put('/startConversion', apiController.startConversion);


module.exports = router;