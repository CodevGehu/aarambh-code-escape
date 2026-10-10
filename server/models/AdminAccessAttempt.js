const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  expires_at: { type: Date, required: true }
}, { versionKey: false });
schema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('AdminAccessAttempt', schema);
