const config = require('config');
const Stat = require('../models/stat');


exports.type = {
    completedConversion:0,    
    streamingAccess:1,    
};

exports.add(type,user, organization, value) {
   
    const stat = new Stat({
        type: type,
        user: user,
        organization: organization,
        value: value
    });

    stat.save();
}
