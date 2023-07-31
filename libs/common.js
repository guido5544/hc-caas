const APIKey = require('../models/UserManagement/ApiKey');
const Conversionitem = require('../models/conversionitem');
const config = require('config');

exports.getUser = async (args) => {
    if (!config.get('hc-caas.requireAccessKey')) {
        return undefined;
    }
    if (!args || !args.accessKey) {
        return -1;
    }

    let key = await APIKey.findOne({ _id: args.accessKey });
    if (!key) {
        return -1;
    }
    return key.user;
}

exports.getConversionItem = async (itemid, args, useNames = false) => {
    if (!config.get('hc-caas.requireAccessKey')) {
        return await Conversionitem.findOne({ storageID: itemid });
    }

    if (!args || !args.accessKey) {
        return null;
    }

    let key = await APIKey.findOne({ _id: args.accessKey });
    if (!key) {
        return null;
    }

    if (!Array.isArray(itemid)) {
        return await Conversionitem.findOne({ storageID: itemid, user: key.user });
    }
    else {
        if (useNames) {
            return await Conversionitem.find({ 'name': { $in: itemid }, user: key.user });
        }
        else {
            return await Conversionitem.find({ storageID: { $in: itemid }, user: key.user });
        }
    }
}