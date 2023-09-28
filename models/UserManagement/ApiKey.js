const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const ApiKeySchema = new Schema({ 
  name: { type: String, required: false},
  valid: { type: Boolean, required: true, default:true},
  user: {
    type: Schema.Types.ObjectId,
    ref: 'Users',
    required: true
  },
  usedAt: { type: Date, required: false},
  readonly: { type: Boolean, required: false, default:false},
}, {timestamps:true});

module.exports = global.con.model('ApiKeys', ApiKeySchema);

