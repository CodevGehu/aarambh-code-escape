const mongoose = require('mongoose');

const mappedQuestionSchema = new mongoose.Schema({
  team_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  level: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  selected_question_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  }
}, {
  timestamps: true
});

// Ensure one question per team per level
mappedQuestionSchema.index({ team_id: 1, level: 1 }, { unique: true });

module.exports = mongoose.model('MappedQuestion', mappedQuestionSchema);
