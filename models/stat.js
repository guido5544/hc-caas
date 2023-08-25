const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const StatSchema = new Schema({ 
  type: { type: Number, required: true},
  user: {
    type: Schema.Types.ObjectId,
    ref: 'Users',
    required: false
  },
  organization: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: false
  },
  value: { type: String, required: true},
}, {timestamps:true});

module.exports = global.con.model('Stat', StatSchema);

