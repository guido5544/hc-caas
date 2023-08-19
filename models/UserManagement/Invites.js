const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const InviteSchema = new Schema({ 
  user: {
    type: Schema.Types.ObjectId,
    ref: 'Users',
    required: true
  },
  organization: {
    type: Schema.Types.ObjectId,
    ref: 'Organizations',
    required: true
  },
}, {timestamps:true});

module.exports = global.con.model('Invites', InviteSchema);

