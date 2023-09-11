const express = require('express');
const apiController = require('../controllers/api');
const router = express.Router();

router.post('/addUser', apiController.addUser);
router.put('/generateAPIKey', apiController.generateAPIKey);
router.get('/checkPassword/:email/:password', apiController.checkPassword);
router.get('/userInfo/:email/:password', apiController.getUserInfo);
router.put('/changeOrgName/:email/:password/:orgid/:orgname', apiController.changeOrgName);
router.put('/updateOrgTokens/:orgid/:tokens', apiController.updateOrgTokens);
router.put('/updateOrgMaxStorage/:orgid/:maxstorage', apiController.updateOrgMaxStorage);
router.get('/retrieveInvite/:inviteid', apiController.retrieveInvite);
router.put('/acceptInvite/:inviteid/:password?', apiController.acceptInvite);
router.get('/getUsers/:email/:password/:orgid?', apiController.getUsers);
router.put('/removeUser/:targetemail/:orgid', apiController.removeUser);
router.put('/deleteUser/:targetemail', apiController.deleteUser);
router.put('/setSuperUser/:targetemail/:superuser', apiController.setSuperUser);
router.put('/addOrganization/:orgname', apiController.addOrganization);
router.post('/updateUser', apiController.updateUser);
router.get('/getOrganizations/:getAll?', apiController.getOrganizations);
router.get('/getOrganization/:orgid', apiController.getOrganization);
router.put('/switchOrganization/:orgid', apiController.switchOrganization);
router.get('/getAPIKeys', apiController.getAPIKeys);
router.put('/invalidateAPIKey/:key', apiController.invalidateAPIKey);
router.put('/editAPIKey/:key', apiController.editAPIKey);
router.get('/getStatsByMonth/:orgid/:month/:year', apiController.getStatsByMonth);
router.put('/injectStats/:orgid', apiController.injectStats);
router.put('/updatePassword', apiController.updatePassword);
router.get('/getFiles/:orgid', apiController.getFiles);
router.get('/getDataAuth/:itemid/:orgid', apiController.getDataAuth);
router.put('/deleteAuth/:orgid/:itemid', apiController.deleteAuth);
router.get('/getItemFromType/:orgid/:itemid/:type?', apiController.getItemFromType);
router.put('/deleteOrganization/:orgid', apiController.deleteOrganization);
router.put('/resetPassword/:targetemail', apiController.resetPassword);



module.exports = router;