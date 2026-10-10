const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  session_id: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  expires_at: { type: Date, required: true },
  revoked_at: { type: Date, default: null }
}, { timestamps: true });
schema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('AdminSession', schema);
