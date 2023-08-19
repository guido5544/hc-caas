const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const UserSchema = new Schema({ 
  firstName: { type: String, required: false},
  lastName: { type: String, required: false},
  email: { type: String, required: true, unique:true},
  password: { type: String, required: true},
  role: { type: Number, required: true, default:1},
  status: { type: String, required: false, default:"active"},
  organizations: [{id:String, role: Number,accepted:Boolean}],
  inviteCode: { type: String, required: false}
}, {timestamps:true});

module.exports = global.con.model('Users', UserSchema);

