const User = require('../models/UserManagement/User');
const Invite = require('../models/UserManagement/Invites');
const Organization = require('../models/UserManagement/Organization');
const APIKey = require('../models/UserManagement/ApiKey');
const Conversionitem = require('../models/conversionitem');

const stats = require('./stats');

const config = require('config');
const bcrypt = require('bcrypt');

exports.actionType = {
    dataAccess:0,    
    streamingAccess:1,    
    conversion: 2,    
    info:3, 
    other:4
};


exports.getUser = async (args) => {
    if (!config.get('hc-caas.requireAccessKey')) {
        return undefined;
    }
    if (!args || !args.accessKey) {
        return -1;
    }

    try {
        let key = await APIKey.findOne({ _id: args.accessKey });
        if (!key) {
            return -1;
        }
        key.usedAt = new Date();
        await key.save();
        let user = await User.findOne(key.user);
        if (!user) {
            return -1;
        }
        return user;
    }
    catch (err) {
        return -1;
    }
}



exports.getUserAdmin = async (args, email,password) => {
    if (config.get('hc-caas.accessPassword') == "" || config.get('hc-caas.accessPassword') != args.accessPassword) {
        return -1;
    }

    if (!email || !password) {
        return null;
    }

    let user = await User.findOne({ email: email});
    let result = await bcrypt.compare(password, user.password);
    if (!result) {
        return -1;
    }

    return user;
}





exports.conversionAllowed = async (args) => {
    if (!config.get('hc-caas.requireAccessKey')) {
        return true;
    }

    if (!args || !args.accessKey) {
        return false;
    }

    let key;
    try {
        key = await APIKey.findOne({ _id: args.accessKey });
        if (!key || !key.valid) {
            return null;
        }
        key.usedAt = new Date();
        await key.save();

    }
    catch (err) {
        return null;
    }

    let user = await User.findOne({ _id: key.user });

    if (!user) {
        return false;
    }

    let org = await Organization.findOne({ _id: user.defaultOrganization });

    if (!org) {
        return false;
    }

    return org.tokens > 10;
}


exports.conversionComplete = async (item) => {
    if (config.get('hc-caas.requireAccessKey')) {
        if (item.organization) {
            let org = await Organization.findOne({ _id: item.organization });
            if (org) {
                org.tokens-=10;
                await org.save();
                stats.add(stats.type.completedConversion, item.user, item.organization,item.name);
            }
        }
    }
}
exports.getConversionItem = async (itemid, args, action = this.actionType.dataAccess, useNames = false) => {
    let user;
    let org;
    let orgid;
    let recordStats = false;
    if (config.get('hc-caas.requireAccessKey')) {
        if (!args || !args.accessKey) {
            return null;
        }

        let key;
        try {
            key = await APIKey.findOne({ _id: args.accessKey });
            if (!key || !key.valid) {
                return null;
            }
            key.usedAt = new Date();
            await key.save();
    
        }
        catch (err) {
            return null;
        }

        user = await User.findOne({ _id: key.user });
        if (!user) {
            return null;
        }
        orgid = user.defaultOrganization;

        if (action == this.actionType.streamingAccess) {
            org = await Organization.findOne({ _id: user.defaultOrganization });

            if (!org) {
                return null;
            }

            if (org.tokens == 0) {
                return null;
            }
            
            if (Array.isArray(itemid)) {
                if (itemid.length > org.tokens) {
                    return null;
                }
                org.tokens -= itemid.length;
                recordStats = true;
            }
            else {
                org.tokens--;
                recordStats = true; 
            }
  

            await org.save();

        }
    }

    if (!Array.isArray(itemid)) {
        let item =  await Conversionitem.findOne({ storageID: itemid, organization: { $in: [orgid, null] } });
        if (recordStats) {
            stats.add(stats.type.streamingAccess, user, org,item.name);
        }
        return item;
    }
    else {
        let items;
        if (useNames) {
            items = await Conversionitem.find({ 'name': { $in: itemid }, organization: { $in: [orgid, null] }  });
        }
        else {
            items = await Conversionitem.find({ storageID: { $in: itemid },  organization: { $in: [orgid, null] } });
        }
        if (recordStats) {
            for (let i=0;i<items.length;i++) {
                stats.add(stats.type.streamingAccess, user, org,items[i].name);
            }
        }
        return items;
    }
}


function findOrgRole(orgid,user) {
    let orgs = user.organizations;
    for (let i = 0; i < orgs.length; i++) {
        if (orgs[i].id == orgid) {
            return orgs[i].role;
        }
    }
    return 99999;
}


function findOrg(orgid,user) {
    let orgs = user.organizations;
    for (let i = 0; i < orgs.length; i++) {
        if (orgs[i].id == orgid) {
            return orgs[i];
        }
    }
}

exports.updatePassword = async (req, args) => {
    let user = await this.getUserAdmin(args,args.email,args.password);
    if (user == -1) {
        return { ERROR: "Not authorized" };
    }

    if (!args.newpassword) {
        return { ERROR: "New password required" };
    }
 
    let password = await bcrypt.hash(args.newpassword, 10);
    
    user.password = password;
    await user.save();
    return {success:true};
}

    
exports.updateUser = async (req, args) => {
    let user = await this.getUserAdmin(args,args.email,args.password);
    if (user == -1) {
        return { ERROR: "Not authorized" };
    }

    if (user && (req.body.role && (findOrgRole(req.body.organizationID,user) > 1 && !user.superuser))) {
        return { ERROR: "Not authorized" };
    }

    let ruser = await User.findOne({ email: req.body.email });

    if (req.body.firstName) {
        ruser.firstName = req.body.firstName 
    }
  
    if (req.body.lastName) {
        ruser.lastName = req.body.lastName 
    }

    if (req.body.role && req.body.organizationID) {       
        for (let i=0;i<ruser.organizations.length;i++) {
            if (ruser.organizations[i].id == req.body.organizationID) {
                ruser.organizations[i].role = req.body.role;               
                break;
            }
        }
    }
    await ruser.save();
    return {success:true};
}

exports.removeUser = async (req, args) => {
    
    let user = await this.getUserAdmin(args,args.email,args.password);
    if (user == -1) {
        return { ERROR: "Not authorized" };
    }

    if (user && (!user.superuser && findOrgRole(req.params.orgid,user) > 1)) {
        return { ERROR: "Not authorized" };
    }


    let ruser = await User.findOne({ email: req.params.targetemail });
    if (!ruser) {
        return { ERROR: "User not found" };
    }

    for (let i=0;i<ruser.organizations.length;i++) {
        if (ruser.organizations[i].id == req.params.orgid) {
            ruser.organizations.splice(i,1);
            await ruser.save();
            break;
        }
    }        

    if (ruser.organizations.length == 0) {
        await User.deleteOne({ email: req.params.targetemail });
    }
    else if (req.params.orgid == ruser.defaultOrganization) {
        ruser.defaultOrganization = ruser.organizations[0].id;
        await ruser.save();
    }

    return {success:true};
}


exports.addUser = async (req, args) => {
    
    let user = await this.getUserAdmin(args,args.email,args.password);
    if (user == -1) {
        return { ERROR: "Not authorized" };
    }

    let org;

    if (req.body.organizationID) {
        if (user && (findOrgRole(req.body.organizationID,user) > 1 && !user.superuser)) {
            return { ERROR: "Not authorized" };
        }
        org = await Organization.findOne({ _id: req.body.organizationID });
        if (!org) {
            return { ERROR: "Organization not found" };
        }
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
        if (findOrgRole(org.id,existingUser) == 99999) {
            existingUser.organizations.push({ id: org.id, role: req.body.role, accepted: true });
            await existingUser.save();
        }
        return { organizationID: org.id };
    }
    else {
        const item = new User({
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            superuser: false,
            password: password,
            organizations: [{ id: org.id, role: req.body.role, accepted: accepted }],
            defaultOrganization: org.id
        });
        await item.save();

        let inviteid;
        if (!password && user) {
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


exports.generateAPIKey = async (req,args) => {

    let user = await this.getUserAdmin(args, args.email, args.password);
    if (user == -1 || !user) {
        return { ERROR: "Not authorized" };
    }

    const item = new APIKey({
        name: args.name,
        user: user
    });
    await item.save();

    return { key: item.id };
};


exports.checkPassword = async (req) => {

    let user = await User.findOne({email:req.params.email});
    if (!user) {
        return { ERROR: "User not found" };        
    }
    if (!user.password) {
        return { ERROR: "No password set" };
    }

    let result = await bcrypt.compare(req.params.password, user.password);
    if (!result) {
        return { ERROR: "wrong password" };        
    }

    return {success: true};
};



exports.getUserInfo = async (req,args) => {

    let user = await User.findOne({email:req.params.email});
    if (!user) {
        return { ERROR: "User not found" };        
    }

    let result = await bcrypt.compare(req.params.password, user.password);
    if (!result) {
        return { ERROR: "wrong password" };        
    }

    let org = await Organization.findOne({ _id: user.defaultOrganization });
    if (!org) {
        return { ERROR: "Organization not found" };
    }
        
    return {email: user.email,firstName:user.firstName, lastName:user.lastName, organization:org.name,organizationID:org.id, superuser: user.superuser, role: findOrgRole(org.id,user)};
};



exports.changeOrgName = async (req,args) => {

    let user = await this.getUserAdmin(args, req.params.email, req.params.password);
    if (user == -1 || !user || (findOrgRole(req.params.orgid,user) > 1 && !user.superuser)) {
        return { ERROR: "Not authorized" };
    }

    let org = await Organization.findOne({ _id: req.params.orgid });
    if (!org) {
        return { ERROR: "Organization not found" };
    }
    org.name = req.params.orgname;
    await org.save();

    return {orgName: org.name};
};



exports.updateOrgTokens = async (req,args) => {

    let user = await this.getUserAdmin(args, args.email, args.password);
    if (user == -1 || !user || !user.superuser) {
        return { ERROR: "Not authorized" };
    }

    let org = await Organization.findOne({ _id: req.params.orgid });
    if (!org) {
        return { ERROR: "Organization not found" };
    }
    org.tokens = req.params.tokens;
    await org.save();
    return {orgName: org.name};
};

exports.addOrganization = async (req,args) => {

    let user = await this.getUserAdmin(args, args.email, args.password);
    if (!user.superuser) {
        return { ERROR: "Not authorized" };

    }

    let org = new Organization({
        name: req.params.orgname
    });
    await org.save();
   
    return { organizationID: org.id};
};



exports.retrieveInvite = async (req,args) => {


    let invite = await Invite.findOne({ _id: req.params.inviteid });
    if (!invite) {
        return { ERROR: "Invite not found" };
    }

    let user = await User.findOne(invite.user);
    let organization = await Organization.findOne(invite.organization);

    return {email: user.email, hasPassword: user.password ? true : false,
        organization: organization.name, organizationID: organization.id};
};


exports.acceptInvite = async (req,args) => {


    let invite = await Invite.findOne({ _id: req.params.inviteid });

    let user = await User.findOne(invite.user);

    if (!user.password) {
        if (!req.params.password) {
            return { ERROR: "Password required" };
        }
        user.password = await bcrypt.hash(req.params.password, 10);
        await user.save();
    }

    let org = await Organization.findOne(invite.organization);

    
    let orgs = user.organizations;
    for (let i = 0; i < orgs.length; i++) {
        if (orgs[i].id == org.id) {
            orgs[i].accepted = true;
            await user.save();
            break;
        }
    }

    await Invite.deleteOne({ _id: req.params.inviteid });

    return {success:true};
};

exports.getUsers = async (req,args) => {

    let user = await this.getUserAdmin(args, req.params.email, req.params.password);
    if (user == -1 || !user || (findOrgRole(req.params.orgid,user) > 2 && !user.superuser)) {
        return { ERROR: "Not authorized" };
    }

    let users = await User.find({'organizations.id': req.params.orgid });

    let result = [];
    for (let i=0;i<users.length;i++) {
        let accepted = findOrg(req.params.orgid,users[i]).accepted;
        let inviteid;
        if (!accepted) {
            let invite = await Invite.findOne({ user: users[i].id });
            if (invite) {
                inviteid = invite.id;
            }
        }
        result.push({firstName:users[i].firstName, lastName:users[i].lastName, email:users[i].email, role:findOrgRole(req.params.orgid,users[i]), accepted:accepted, inviteid:inviteid});
    }
    return {users:result};
}



exports.getOrganizations = async (req,args) => {

    let user = await this.getUserAdmin(args, args.email, args.password);
    if (user == -1 || !user) {
        return { ERROR: "Not authorized" };
    }

    if (user.superuser && req.params.getAll == 'true') {

        let orgs = await Organization.find();
        let result = [];
        for (let i = 0; i < orgs.length; i++) {
            result.push({ name: orgs[i].name, id: orgs[i].id });
        }
        return { organizations: result };
    }

    let result = [];
    for (let i=0;i<user.organizations.length;i++) {
        let org = await Organization.findOne({ _id: user.organizations[i].id });
        result.push({name:org.name,id:org.id,role:user.organizations[i].role});
    }

    return {organizations:result};
}



exports.getOrganization = async (req,args) => {

    let user = await this.getUserAdmin(args, args.email, args.password);
    if (user == -1 || !user) {
        return { ERROR: "Not authorized" };
    }
   let org = await Organization.findOne({ _id: req.params.orgid });

    return {orgname:org.name, tokens:org.tokens};
}




exports.switchOrganization = async (req,args) => {

    let user = await this.getUserAdmin(args, args.email, args.password);
    if (user == -1 || !user) {
        return { ERROR: "Not authorized" };
    }

    for (let i=0;i<user.organizations.length;i++) {
        if (user.organizations[i].id == req.params.orgid) {
            user.defaultOrganization = req.params.orgid;
            await user.save();
            return {success:true};
        }
    }

    return { ERROR: "User is not part of this Organization" };
}




exports.getAPIKeys = async (req,args) => {

    let user = await this.getUserAdmin(args, args.email, args.password);
    if (user == -1 || !user) {
        return { ERROR: "Not authorized" };
    }

    let keys = await APIKey.find({ user: user.id });

    let result = [];
    for (let i = 0; i < keys.length; i++) {
        result.push({ name: keys[i].name, created: keys[i].createdAt,usedAt: keys[i].usedAt,key: keys[i].id, valid: keys[i].valid });
    }
    return { keys: result };
}


exports.invalidateAPIKey = async (req,args) => {

    let user = await this.getUserAdmin(args, args.email, args.password);
    if (user == -1 || !user) {
        return { ERROR: "Not authorized" };
    }

    let keys = await APIKey.find({ user: user.id });
    for (let i = 0; i < keys.length; i++) {
        if (keys[i].id == req.params.key) {
            keys[i].valid = false;
            await keys[i].save();
            return {success:true};
        }
    }

    return { ERROR: "Key not found" };
}


exports.editAPIKey = async (req,args) => {

    let user = await this.getUserAdmin(args, args.email, args.password);
    if (user == -1 || !user) {
        return { ERROR: "Not authorized" };
    }

    let keys = await APIKey.find({ user: user.id });
    for (let i = 0; i < keys.length; i++) {
        if (keys[i].id == req.params.key) {
            keys[i].name = args.name;
            await keys[i].save();
            return {success:true};
        }
    }

    return { ERROR: "Key not found" };
}