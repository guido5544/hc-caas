const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const OrganizationSchema = new Schema({ 
  name: { type: String, required: true},
}, {timestamps:true});

module.exports = global.con.model('Organizations', OrganizationSchema);

