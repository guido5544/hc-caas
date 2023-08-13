const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const streamingserveritemSchema = new Schema({ 
  address: {
    type: String,
    required: true
  },
  freeStreamingSlots: {
    type: Number,
    required: true
  },
  region: {
    type: String,
    required: false
  },
  streamingRegion: {
    type: String,
    required: false
  },
  renderType: {
    type: String,
    required: false
  },
  name: {
    type: String,
    required: false
  },
  lastPing: {
    type: Date,
    required: false
  },
  pingFailed: {
    type: Boolean,
    required: false
  },
  priority: {
    type: Number,
    required: false
  }
});

module.exports = global.con.model('Streamingserveritem', streamingserveritemSchema);

