const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const UserSchema = new Schema({ 
  firstName: { type: String, required: false},
  lastName: { type: String, required: false},
  email: { type: String, required: true, unique:true},
  password: { type: String, required: true},
  status: { type: String, required: false, default:"active"},
  organization: {
    type: Schema.Types.ObjectId,
    ref: 'Organizations',
    required: false
  }
}, {timestamps:true});

module.exports = global.con.model('Users', UserSchema);

