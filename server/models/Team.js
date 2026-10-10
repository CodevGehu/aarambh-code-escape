const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  team_name: {
    type: String,
    required: true,
    trim: true
  },
  leader_name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  members: {
    type: [String],
    default: []
  },
  question_set_id: {
    type: String,
    default: null
  },
  current_level: {
    type: Number,
    default: 0
  },
  access_code_hash: { type: String, select: false },
  active_session_id: { type: String, default: null, select: false },
  aarambh_registration_id: { type: String },
  access_enabled: { type: Boolean, default: true },
  event_run_id: { type: String, default: null },
  event_open: { type: Boolean, default: false },
  progress_version: { type: Number, default: 0 },
  puzzle_write_version: { type: Number, default: 0 },
  round_started_at: { type: Date, default: null },
  carry_ms: { type: Number, default: 0 },
  overtime_continued_at: { type: Date, default: null },
  score_reached_at: { type: Date, default: null },
  outcomes: { type: [mongoose.Schema.Types.Mixed], default: [] },
  event_history: { type: [mongoose.Schema.Types.Mixed], default: [] },
  total_points: {
    type: Number,
    default: 0
  },
  // Tracks exact points earned at each level (key = level number as string)
  // e.g. { "1": 100, "2": 200, "3": 300 }
  level_points: {
    type: Object,
    default: {}
  },
  start_time: {
    type: Date,
    default: null
  },
  end_time: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

teamSchema.index({ aarambh_registration_id: 1 }, { unique: true,
  partialFilterExpression: { aarambh_registration_id: { $type: 'string' } } });
module.exports = mongoose.model('Team', teamSchema);
