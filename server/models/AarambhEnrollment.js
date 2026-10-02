const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  _id: { type: String },
  version: { type: Number, required: true },
  status: { type: String, enum: ['approved', 'revoked'], required: true },
  team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null }
}, { timestamps: true });
module.exports = mongoose.model('AarambhEnrollment', schema);
