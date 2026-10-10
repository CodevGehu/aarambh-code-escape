const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  owner: { type: String, required: true }, question_id: { type: String, required: true },
  instance_id: { type: String, required: true, unique: true }, kind: String,
  purpose: { type: String, default: 'interactive' },
  private_data: { type: mongoose.Schema.Types.Mixed, required: true, select: false },
  stage: { type: String, default: 'initial' }, probes: { type: [mongoose.Schema.Types.Mixed], default: [] },
  expires_at: { type: Date, required: true }
}, { timestamps: true });
schema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
schema.index({ owner: 1, question_id: 1, purpose: 1 }, { unique: true, partialFilterExpression: { purpose: 'booklet' } });
module.exports = mongoose.model('PuzzleRehearsal', schema);
