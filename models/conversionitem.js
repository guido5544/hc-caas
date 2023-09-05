const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const conversionitemSchema = new Schema({ 
  name: {
    type: String,
    required: true
  },
  storageID: {
    type: String,
    required: true
  },
  startPath: {
    type: String,
    required: false
  },

  conversionState: {
    type: String,
    required: true
  },
  detailedError: {
    type: String,
    required: false
  },
  updated: {
    type:Date,
    required: true
  },

  created: {
    type:Date,
    required: true
  },

  shattered: {
    type: Boolean,
    required: false
  },

  multiConvert: {
    type: Boolean,
    required: false
  },

  webhook: {
    type: String,
    required: false
  },

  conversionCommandLine: {
    type: Object,
    required: false
  },
  files: {
    type: Array,
    required: true
  },
  storageAvailability: {
    type: Array,
    required: false
  },
  streamLocation: {
    type: String,
    required: false
  },
  hcVersion: {
    type: String,
    required: false
  },
  size: {
    type: Number,
    required: false
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'Users',
    required: false
  },
  organization: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: false
  }

});

module.exports = global.con.model('Conversionitem', conversionitemSchema);

