const { randomInt } = require('crypto');
const Question = require('../models/Question');
const Team = require('../models/Team');
const MappedQuestion = require('../models/MappedQuestion');
const QuizState = require('../models/QuizState');
const { rosterFilter } = require('./registrationPolicy');

function configurationError(message) {
  return Object.assign(new Error(message), { code: 'QUESTION_SET_CONFIGURATION' });
}

function getQuestionSetIds(questions) {
  const sets = new Map();
  for (const question of questions) {
    if (!question.set_id || !Number.isInteger(question.level) || question.level < 1 || question.level > 5) {
      throw configurationError('Every question needs a set ID and a round from 1 to 5.');
    }
    const levels = sets.get(question.set_id) || new Set();
    if (levels.has(question.level)) {
      throw configurationError(`Set ${question.set_id} has more than one question for round ${question.level}.`);
    }
    levels.add(question.level);
    sets.set(question.set_id, levels);
  }
  if (!sets.size) throw configurationError('No question sets are available.');
  for (const [setId, levels] of sets) {
    if (levels.size !== 5) {
      throw configurationError(`Set ${setId} must contain all five rounds before the quiz can start.`);
    }
  }
  return [...sets.keys()].sort();
}

// Keep existing assignments; shuffle new teams and place each in a least-used set.
function planSetAssignments(teams, setIds, pickIndex = randomInt) {
  const counts = new Map(setIds.map(id => [id, 0]));
  const pending = [];
  for (const team of teams) {
    if (!team.question_set_id) {
      pending.push(team);
    } else if (!counts.has(team.question_set_id)) {
      throw configurationError(`Assigned set ${team.question_set_id} is no longer available.`);
    } else {
      counts.set(team.question_set_id, counts.get(team.question_set_id) + 1);
    }
  }
  for (let i = pending.length - 1; i > 0; i--) {
    const j = pickIndex(i + 1);
    [pending[i], pending[j]] = [pending[j], pending[i]];
  }
  return pending.map(team => {
    const min = Math.min(...counts.values());
    const candidates = setIds.filter(id => counts.get(id) === min);
    const setId = candidates[pickIndex(candidates.length)];
    counts.set(setId, counts.get(setId) + 1);
    return { team, setId };
  });
}

async function prepareTeamQuestionSets() {
  const questions = await Question.find({}).select('_id set_id level').lean();
  const setIds = getQuestionSetIds(questions);
  const teams = await Team.find(rosterFilter()).select('_id question_set_id').lean();
  const unassigned = teams.filter(team => !team.question_set_id);
  if (!unassigned.length) {
    planSetAssignments(teams, setIds); // Validate existing assignments as well.
    return;
  }

  // Preserve a legacy team's original path instead of assigning a different set.
  const mappings = await MappedQuestion.find({ team_id: { $in: unassigned.map(team => team._id) } })
    .sort({ level: 1 }).lean();
  const questionSets = new Map(questions.map(question => [String(question._id), question.set_id]));
  const legacySets = new Map();
  for (const mapping of mappings) {
    const setId = questionSets.get(String(mapping.selected_question_id));
    if (!setId) throw configurationError('An existing question assignment references a missing question.');
    const teamId = String(mapping.team_id);
    if (legacySets.has(teamId) && legacySets.get(teamId) !== setId) {
      throw configurationError('An existing team has mixed question sets; reset the quiz before assigning sets.');
    }
    legacySets.set(teamId, setId);
  }

  let state;
  try {
    state = await QuizState.findOneAndUpdate(
      { key: 'global' }, { $setOnInsert: { key: 'global' } }, { upsert: true, new: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    state = await QuizState.findOne({ key: 'global' });
  }

  let committed;
  for (let attempt = 0; attempt < 3; attempt++) {
    committed = new Map((state.question_set_assignments || []).map(entry => [entry.team_id, entry.set_id]));
    const candidates = teams.map(team => {
      const teamId = String(team._id);
      const currentSet = team.question_set_id || legacySets.get(teamId);
      if (currentSet && committed.has(teamId) && currentSet !== committed.get(teamId)) {
        throw configurationError('A team assignment conflicts with the committed allocation plan.');
      }
      return { ...team, question_set_id: currentSet || committed.get(teamId) || null };
    });
    const proposed = new Map(committed);
    for (const team of candidates) {
      if (team.question_set_id) proposed.set(String(team._id), team.question_set_id);
    }
    for (const { team, setId } of planSetAssignments(candidates, setIds)) {
      proposed.set(String(team._id), setId);
    }
    if (proposed.size === committed.size && [...proposed].every(([id, setId]) => committed.get(id) === setId)) {
      break;
    }

    // Commit the entire plan atomically before writing individual team documents.
    // Competing workers adopt the winner's plan instead of combining random plans.
    const version = state.question_set_assignment_version || 0;
    const versionFilter = version === 0
      ? { $or: [{ question_set_assignment_version: 0 }, { question_set_assignment_version: { $exists: false } }] }
      : { question_set_assignment_version: version };
    const updated = await QuizState.findOneAndUpdate(
      { key: 'global', ...versionFilter },
      {
        $set: { question_set_assignments: [...proposed].map(([team_id, set_id]) => ({ team_id, set_id })) },
        $inc: { question_set_assignment_version: 1 }
      },
      { new: true }
    );
    if (updated) {
      committed = proposed;
      break;
    }
    if (attempt === 2) {
      throw configurationError('Team assignment is busy. Retry starting the quiz.');
    }
    state = await QuizState.findOne({ key: 'global' });
  }

  const operations = unassigned.map(team => ({
    updateOne: {
      filter: { _id: team._id, question_set_id: null },
      update: { $set: { question_set_id: committed.get(String(team._id)) } }
    }
  }));
  if (operations.length) await Team.bulkWrite(operations);
}

module.exports = { getQuestionSetIds, planSetAssignments, prepareTeamQuestionSets };
