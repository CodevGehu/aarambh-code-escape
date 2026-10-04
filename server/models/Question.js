const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  level: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  question_text: {
    type: String,
    required: true
  },
  correct_answer: {
    type: String,
    required: true,
    trim: true
  },
  points: {
    type: Number,
    required: true,
    default: 100
  },
  set_id: {
    type: String,
    required: true
  },
  // Legacy hunt clues remain text questions. Interactive rounds are judged by
  // their server-owned rules, never by a shared answer or client completion flag.
  puzzle_type: { type: String, enum: ['fence', 'sliding', 'packing', 'machine', 'courier', 'fold', 'shadow'] },
  archived: { type: Boolean, default: false }
}, {
  timestamps: true
});

questionSchema.index({ level: 1, set_id: 1 });

module.exports = mongoose.model('Question', questionSchema);
