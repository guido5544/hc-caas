const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const ApiKeySchema = new Schema({ 
  user: {
    type: Schema.Types.ObjectId,
    ref: 'Users',
    required: true
  },
}, {timestamps:true});

module.exports = global.con.model('ApiKeys', ApiKeySchema);

