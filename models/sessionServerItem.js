const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const sessionServerItemSchema = new Schema({ 
  type: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  freeSessionSlots: {
    type: Number,
    required: true
  },
  region: {
    type: String,
    required: false
  },
  sessionRegion: {
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
  },
  extraData: {
    type: Object,
    required: false
  }
});

module.exports = global.con.model('SessionServerItem', sessionServerItemSchema);

