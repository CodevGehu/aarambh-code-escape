const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  team_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true,
    unique: true
  },
  total_points: {
    type: Number,
    required: true,
    default: 0
  },
  completion_time: {
    type: Number, // milliseconds
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Result', resultSchema);
