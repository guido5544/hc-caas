const express = require('express');
const apiController = require('../controllers/api');
const router = express.Router();

router.put('/customCallback', apiController.putCustomCallback);
module.exports = router;