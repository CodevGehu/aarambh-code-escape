const Team = require('../models/Team');
const Result = require('../models/Result');
const MappedQuestion = require('../models/MappedQuestion');
const Question = require('../models/Question');
const QuizState = require('../models/QuizState');

// Helper to normalize strings
const normalize = (str) => String(str).toLowerCase().trim().replace(/\s+/g, ' ');

// POST /api/progress/submit
const submitProgress = async (req, res) => {
  try {
    // 1. Check QuizState
    const state = await QuizState.findOne({ key: 'global' });
    if (!state || state.status !== 'active') {
      return res.status(403).json({ error: 'Quiz is currently inactive.' });
    }

    // 2. Extract inputs
    const { level, answer } = req.body;

    if (level === undefined || answer === undefined) {
      return res.status(400).json({ error: 'Missing required fields: level, answer' });
    }

    const levelNum = parseInt(level, 10);
    if (isNaN(levelNum)) {
      return res.status(400).json({ error: 'Invalid level; must be an integer' });
    }

    // 3. Prevent IDOR by identifying user from token payload
    const email = req.user.email?.toLowerCase().trim();
    if (!email) {
      return res.status(400).json({ error: 'Email not found in token payload' });
    }

    const team = await Team.findOne({ email });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // 4. Validate progression matches mapped state
    if (levelNum !== team.current_level) {
      return res.status(400).json({ error: 'Can only submit progress for current level' });
    }

    // 5. Look up backend mapping and actual question
    const mapping = await MappedQuestion.findOne({ team_id: team._id, level: levelNum });
    if (!mapping) {
      return res.status(404).json({ error: 'No question mapping found for this level.' });
    }

    const question = await Question.findById(mapping.selected_question_id);
    if (!question) {
      return res.status(404).json({ error: 'Question not found in database.' });
    }
    if (team.question_set_id && question.set_id !== team.question_set_id) {
      return res.status(409).json({ error: 'Question assignment does not match your team set. Contact an organizer.' });
    }

    // 6. Secure Validation: Normalize string compare
    const isCorrect = normalize(answer) === normalize(question.correct_answer);
    if (!isCorrect) {
      return res.status(400).json({ code: 'INCORRECT_ANSWER', error: 'Incorrect answer' });
    }

    // 7. Atomic update lock to prevent Race Conditions
    const isFinalLevel = levelNum >= 5;
    const updatePayload = {
      $inc: { total_points: question.points },
      $set: {
        current_level: isFinalLevel ? 6 : levelNum + 1,
        [`level_points.${levelNum}`]: question.points  // Track exact points per level
      }
    };

    if (isFinalLevel) {
      updatePayload.$set.end_time = new Date();
    }

    // Only update if current_level matches (prevents race condition double-submit)
    const updatedTeam = await Team.findOneAndUpdate(
      { _id: team._id, current_level: levelNum },
      updatePayload,
      { new: true } // return updated doc
    );

    if (!updatedTeam) {
      return res.status(409).json({ error: 'Progress already recorded (Conflict).' });
    }

    // 8. Log results
    if (isFinalLevel) {
      let completionTime = null;
      if (updatedTeam.start_time && updatedTeam.end_time) {
        completionTime = updatedTeam.end_time.getTime() - updatedTeam.start_time.getTime();
      }

      await Result.findOneAndUpdate(
        { team_id: updatedTeam._id },
        {
          team_id: updatedTeam._id,
          total_points: updatedTeam.total_points,
          completion_time: completionTime
        },
        { upsert: true, new: true }
      );
    }

    res.json({
      success: true,
      points_awarded: question.points,
      team: {
        _id: updatedTeam._id,
        team_name: updatedTeam.team_name,
        current_level: updatedTeam.current_level,
        total_points: updatedTeam.total_points,
        start_time: updatedTeam.start_time,
        end_time: updatedTeam.end_time
      }
    });

  } catch (error) {
    console.error('Submit progress error:', error);
    res.status(500).json({ error: 'Server error submitting progress' });
  }
};

module.exports = { submitProgress };
