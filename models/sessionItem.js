const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const sessionItemSchema = new Schema({ 
  type: {
    type: String,
    required: true
  },
  serveraddress: {
    type: String,
    required: true
  },
  slot: {
    type: Number,
    required: true
  },
  sessionLocation: {
    type: String,
    required: false
  }
});

module.exports = global.con.model('SessionItem', sessionItemSchema);

