const express = require('express');
const apiController = require('../controllers/api');
const router = express.Router();


router.get('/startCustomSession/:type', apiController.startCustomSession);
router.get('/startCustomSessionServer/:type', apiController.startCustomSessionServer);
router.get('/pingSessionServer/:type', apiController.pingSessionServer);



module.exports = router;