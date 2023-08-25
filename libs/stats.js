const config = require('config');
const Stat = require('../models/stat');
const authorization = require('./authorization');


exports.type = {
    completedConversion:0,    
    streamingAccess:1,    
};



function findOrgRole(orgid,user) {
    let orgs = user.organizations;
    for (let i = 0; i < orgs.length; i++) {
        if (orgs[i].id == orgid) {
            return orgs[i].role;
        }
    }
    return 99999;
}


exports.add = async (type,user, organization, value) => {
   
    const stat = new Stat({
        type: type,
        user: user,
        organization: organization,
        value: value
    });

    stat.save();
}



exports.getStatsByMonth = async (req,args) => {
    let user = await authorization.getUserAdmin(args, args.email, args.password);
    if (user == -1 || !user || findOrgRole(req.params.orgid,user) > 2) {
        return { ERROR: "Not authorized" };
    }

    const month = parseInt(req.params.month);  
    const year = parseInt(req.params.year);
    
    const firstDayOfMonth = new Date(year, month-1, 1);
    const firstDayOfNextMonth = new Date(year, month, 1); 
    
    
    let items = await Stat.find({createdAt: {
        $gte: firstDayOfMonth,
        $lt: firstDayOfNextMonth
        }, 
        organization: req.params.orgid
      });


   let stats = [];
   for (let i = 0; i < items.length; i++) {
         const item = items[i];
         stats.push({type:item.type, value:item.value, createdAt:item.createdAt});
       
   }

   return {stats:stats};
}
