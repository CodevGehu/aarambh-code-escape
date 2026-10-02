const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  event_id: { type: String, unique: true, required: true },
  team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  action: { type: String, required: true },
  level: { type: Number, default: null },
  timestamp: { type: Date, default: Date.now },
  delta: { type: Number, default: 0 },
  before: mongoose.Schema.Types.Mixed,
  after: mongoose.Schema.Types.Mixed,
  metadata: mongoose.Schema.Types.Mixed
}, { versionKey: false });
schema.index({ timestamp: -1, _id: -1 });
schema.index({ team_id: 1, timestamp: -1 });
module.exports = mongoose.model('EventLog', schema);
