const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const streamingsessionitemSchema = new Schema({ 
  serveraddress: {
    type: String,
    required: true
  },
  slot: {
    type: Number,
    required: true
  },
  streamLocation: {
    type: String,
    required: false
  },
});

module.exports = global.con.model('Streamingsessionitem', streamingsessionitemSchema);

