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


exports.getUserAdmin = async (args, email,password) => {
    if (config.get('hc-caas.accessPassword') == "" || config.get('hc-caas.accessPassword') != args.accessPassword) {
        return -1;
    }

    if (!email) {
        return null;
    }

    let user = await User.findOne({ id: email});
    let result = await bcrypt.compare(password, user.password);
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





exports.updateUser = async (req, args) => {
    let user = await this.getUserAdmin(args,args.email,args.password);
    if (user == -1) {
        return { ERROR: "Not authorized" };
    }

    if (user && findOrgRole(req.body.organizationID,user) > 1) {
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
                await ruser.save();
                break;
            }
        }
    }
    return {success:true};
}



exports.removeUser = async (req, args) => {
    
    let user = await this.getUserAdmin(args,args.email,args.password);
    if (user == -1) {
        return { ERROR: "Not authorized" };
    }

    if (user && findOrgRole(req.params.orgid,user) > 1) {
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
    return {success:true};
}

    


exports.addUser = async (req, args) => {
    
    let user = await this.getUserAdmin(args,args.email,args.password);
    if (user == -1) {
        return { ERROR: "Not authorized" };
    }

    let org;

    if (req.body.organizationID && (!user || user.superuser == 0)) {
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
        if (findOrgRole(org.id,existingUser) == 99999) {
            existingUser.organizations.push({ id: org.id, role: req.body.role, accepted: accepted });
            await existingUser.save();
        }
        return { organizationID: org.id };
    }
    else {
        const item = new User({
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            superuser: req.body.role == 0 ? true : false,
            password: password,
            organizations: [{ id: org.id, role: (req.body.role == 0 ? 1 :req.body.role), accepted: accepted }],
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

    let org = await Organization.findOne({ id: user.defaultOrganization });

    return {firstName:user.firstName, lastName:user.lastName, organization:org.name,organizationID:org.id, superuser: user.superuser, role: findOrgRole(org.id,user)};
};



exports.changeOrgName = async (req,args) => {

    let user = await this.getUserAdmin(args, req.params.email, req.params.password);
    if (user == -1 || !user || findOrgRole(req.params.orgid,user) > 1) {
        return { ERROR: "Not authorized" };
    }

    let org = await Organization.findOne({ id: req.params.orgid });
    if (!org) {
        return { ERROR: "Organization not found" };
    }
    org.name = req.params.orgname;
    await org.save();

    return {orgName: org.name};
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
    if (user == -1 || !user || findOrgRole(req.params.orgid,user) > 2) {
        return { ERROR: "Not authorized" };
    }

    let users = await User.find({'organization': req.params.orgid });

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

