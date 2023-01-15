const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const queueserveritemSchema = new Schema({ 
  address: {
    type: String,
    required: true
  },
  freeConversionSlots: {
    type: Number,
    required: true
  }
  
});

module.exports = global.con.model('Queueserveritem', queueserveritemSchema);

