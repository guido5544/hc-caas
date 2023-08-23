const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const OrganizationSchema = new Schema({ 
  name: { type: String, required: true},
  tokens: { type: Number, required: true, default:1000}
}, {timestamps:true});

module.exports = global.con.model('Organizations', OrganizationSchema);

