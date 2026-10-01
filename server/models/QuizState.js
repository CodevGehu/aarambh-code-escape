const mongoose = require('mongoose');

const quizStateSchema = new mongoose.Schema({
  key: { type: String, default: 'global', unique: true },
  status: {
    type: String,
    enum: ['not_started', 'active', 'ended'],
    default: 'not_started'
  },
  started_at: { type: Date, default: null },
  ended_at: { type: Date, default: null },
  // One committed allocation plan shared by every backend worker.
  question_set_assignments: {
    type: [new mongoose.Schema({
      team_id: { type: String, required: true },
      set_id: { type: String, required: true }
    }, { _id: false })],
    default: []
  },
  question_set_assignment_version: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('QuizState', quizStateSchema);
