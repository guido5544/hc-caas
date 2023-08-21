const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const UserSchema = new Schema({ 
  firstName: { type: String, required: false},
  lastName: { type: String, required: false},
  email: { type: String, required: true, unique:true},
  password: { type: String, required: false},
  superuser: { type: Boolean, required: true, default:false},
  organizations: [{id:String, role: Number,accepted:Boolean}],
  defaultOrganization: { type: String, required: false}, 
}, {timestamps:true});

module.exports = global.con.model('Users', UserSchema);

