const User = require('../models/UserManagement/User');
const Invite = require('../models/UserManagement/Invites');
const Organization = require('../models/UserManagement/Organization');
const APIKey = require('../models/UserManagement/ApiKey');
const Conversionitem = require('../models/conversionitem');
const config = require('config');
const bcrypt = require('bcrypt');


exports.getUserID = async (args) => {
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


exports.getUserAdmin = async (args) => {
    if (config.get('hc-caas.accessPassword') == "" || config.get('hc-caas.accessPassword') != args.accessPassword) {
        return -1;
    }

    if (!args.email) {
        return null;
    }

    let user = await User.findOne({ id: args.email});
    let result = await bcrypt.compare(args.password, user.password);
    if (!result) {
        return -1;
    }

    return user;
}

exports.getConversionItem = async (itemid, args, useNames = false) => {
    let user = undefined;


    if (config.get('hc-caas.requireAccessKey')) {
        if (!args || !args.accessKey) {
            return null;
        }

        let key = await APIKey.findOne({ _id: args.accessKey });
        if (!key) {
            return null;
        }
        user = key.user;
    }
    

    if (!Array.isArray(itemid)) {
        return await Conversionitem.findOne({ storageID: itemid, user: user });
    }
    else {
        if (useNames) {
            return await Conversionitem.find({ 'name': { $in: itemid }, user: user });
        }
        else {
            return await Conversionitem.find({ storageID: { $in: itemid }, user: user });
        }
    }
}


function findOrgRole(orgid,user) {
    let orgs = user.organizations;
    for (let i = 0; i < orgs.length; i++) {
        if (orgs[i].id == orgid) {
            return orgs[i].role;
        }
    }
    return -1;
}


exports.addUser = async (req, args) => {
    
    let user = await this.getUserAdmin(args);
    if (user == -1) {
        return { ERROR: "Not authorized" };
    }

    let org;

    if (req.body.organizationID && (!user || user.role == 0)) {
        org = await Organization.findOne({ id: req.body.organizationID });
        if (!org) {
            return { ERROR: "Organization not found" };
        }
    }
    else if (user && user.defaultOrganization) {
        if (findOrgRole(user.defaultOrganization,user) > 1) {
            return { ERROR: "Not authorized" };
        }
        org = await Organization.findOne({ id: user.defaultOrganization });
    }
    
    let accepted = false;

    if (!org) {
        org = new Organization({
            name: "Temp"
        });
        await org.save();
        accepted = true;
    }

    let password;
    
    if (req.body.password) {
        password = await bcrypt.hash(req.body.password, 10);
    }

    let existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
        if (findOrgRole(org.id,existingUser) == -1) {
            existingUser.organizations.push({ id: org.id, role: 1, accepted: accepted });
            await existingUser.save();
        }
        return { organizationID: org.id };
    }
    else {
        const item = new User({
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            password: password,
            organizations: [{ id: org.id, role: 1, accepted: accepted }],
            defaultOrganization: org.id
        });
        await item.save();

        let inviteid;
        if (!password) {
            let newinvite = new Invite({
                user: item,
                organization: org,
            })
            await newinvite.save();
            inviteid = newinvite.id;
        }

        return { organizationID: org.id,inviteid:inviteid };
    }
};


exports.generateAPIKey = async (req) => {

    let user = await User.findOne({email:req.params.email});
    if (!user) {
        return { ERROR: "User not found" };        
    }

    let result = await bcrypt.compare(req.params.password, user.password);
    if (!result) {
        return { ERROR: "wrong password" };        

    }

    await APIKey.deleteOne({ user: user.id });
    
    const item = new APIKey({
    user: user
   });
   await item.save();

   return {key:item.id};    
};


exports.checkPassword = async (req) => {

    let user = await User.findOne({email:req.params.email});
    if (!user) {
        return { ERROR: "User not found" };        
    }

    let result = await bcrypt.compare(req.params.password, user.password);
    if (!result) {
        return { ERROR: "wrong password" };        
    }

    return {success: true};
};



exports.getUserInfo = async (req) => {

    let user = await User.findOne({email:req.params.email});
    if (!user) {
        return { ERROR: "User not found" };        
    }

    let result = await bcrypt.compare(req.params.password, user.password);
    if (!result) {
        return { ERROR: "wrong password" };        
    }

    let org = await Organization.findOne({ id: user.defaultOrganization });

    return {firstName:user.firstName, lastName:user.lastName, organization:org.name,organizationID:org.id};
};



exports.changeOrgName = async (req) => {

    let user = await User.findOne({email:req.params.email});
    if (!user) {
        return { ERROR: "User not found" };        
    }

    let result = await bcrypt.compare(req.params.password, user.password);
    if (!result) {
        return { ERROR: "wrong password" };        
    }

    let org = await Organization.findOne({ id: user.defaultOrganization });

    return {firstName:user.firstName, lastName:user.lastName, organization:org.name,organizationID:org.id};
};