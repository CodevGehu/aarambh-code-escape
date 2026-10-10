const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  event_run_id: { type: String, required: true },
  team_id: { type: String, required: true },
  question_id: { type: String, required: true },
  puzzle_version: { type: Number, required: true },
  instance_id: { type: String, required: true, unique: true },
  kind: { type: String, required: true },
  private_data: { type: mongoose.Schema.Types.Mixed, required: true, select: false },
  stage: { type: String, default: 'initial' },
  probes: { type: [mongoose.Schema.Types.Mixed], default: [] },
  answer_attempts: { type: Number, default: 0 },
  answer_window: { type: Date, default: null }
}, { timestamps: true });
schema.index({ event_run_id: 1, team_id: 1, question_id: 1, puzzle_version: 1 }, { unique: true });
module.exports = mongoose.model('RoundPuzzleState', schema);
