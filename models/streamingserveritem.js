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
  }  
});

module.exports = global.con.model('Streamingserveritem', streamingserveritemSchema);

