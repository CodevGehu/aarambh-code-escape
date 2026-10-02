const mongoose = require('mongoose');
const Team = require('../models/Team');
const QuizState = require('../models/QuizState');
const EventLog = require('../models/EventLog');
const { publicTeam, getEventState } = require('../services/eventRules');
const { compareTeams } = require('../services/rankings');
const { recordObservedTimeouts } = require('../services/activityLog');
const { rosterFilter, isRosterTeam } = require('../services/registrationPolicy');

function logFilter(query, teams = []) {
  const filter = {};
  if (query.team_id) {
    if (typeof query.team_id !== 'string' || !/^[a-f\d]{24}$/i.test(query.team_id)) {
      throw Object.assign(new Error('Choose a valid team.'), { status: 400 });
    }
    filter.team_id = new mongoose.Types.ObjectId(query.team_id);
  }
  if (query.action) {
    if (typeof query.action !== 'string' || !/^[a-z][a-z0-9_]{0,79}$/i.test(query.action)) {
      throw Object.assign(new Error('Choose a valid action.'), { status: 400 });
    }
    filter.action = query.action;
  }
  if (query.level) {
    if (!/^[1-5]$/.test(String(query.level))) throw Object.assign(new Error('Round must be 1 to 5.'), { status: 400 });
    filter.level = Number(query.level);
  }
  if (query.search != null && query.search !== '') {
    if (typeof query.search !== 'string' || query.search.length > 100) {
      throw Object.assign(new Error('Search must be text with at most 100 characters.'), { status: 400 });
    }
    const search = query.search.trim();
    if (search) {
      const literal = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[ _]+');
      const needle = search.toLowerCase();
      const teamIds = teams.filter(team => `${team.team_name} ${team.leader_name || ''}`.toLowerCase().includes(needle)).map(team => team._id);
      filter.$or = [{ action: { $regex: literal, $options: 'i' } }, { team_id: { $in: teamIds } }];
      if ('organizer'.includes(needle)) filter.$or.push({ team_id: null });
    }
  }
  return filter;
}

function pageNumber(value, fallback, max) {
  return /^\d+$/.test(String(value || '')) ? Math.min(max, Math.max(1, Number(value))) : fallback;
}

async function getTeams(req, res) {
  try {
    const [teams, state, activities] = await Promise.all([
      Team.find(rosterFilter({ includeRevoked: true })).select('+active_session_id').lean(),
      QuizState.findOne({ key: 'global' }),
      EventLog.aggregate([
        { $match: { team_id: { $ne: null } } }, { $sort: { timestamp: -1, _id: -1 } },
        { $group: { _id: '$team_id', timestamp: { $first: '$timestamp' }, action: { $first: '$action' } } }
      ])
    ]);
    const now = new Date();
    await recordObservedTimeouts(teams, state, now);
    const lastActivity = new Map(activities.map(activity => [String(activity._id), activity]));
    teams.sort(compareTeams);
    const ranks = new Map(teams.filter(team => isRosterTeam(team)).map((team, index) => [String(team._id), index + 1]));
    res.json({
      teams: teams.map(team => ({ ...publicTeam(team, state, now),
        rank: ranks.get(String(team._id)) || null, access_enabled: team.access_enabled !== false,
        session_active: Boolean(team.active_session_id),
        score_reached_at: team.score_reached_at || null,
        last_activity: lastActivity.get(String(team._id)) || null })),
      event: getEventState(state, now)
    });
  } catch {
    res.status(503).json({ error: 'Unable to load teams. Try refreshing.' });
  }
}

async function getLogs(req, res) {
  try {
    logFilter(req.query); // Reject invalid input before doing a database lookup.
    const teams = await Team.find({}).select('_id team_name leader_name').lean();
    const filter = logFilter(req.query, teams);
    const page = pageNumber(req.query.page, 1, 10000);
    const pageSize = pageNumber(req.query.page_size, 30, 100);
    const [logs, total, actions] = await Promise.all([
      EventLog.find(filter).select('team_id action level timestamp delta before after').sort({ timestamp: -1, _id: -1 })
        .skip((page - 1) * pageSize).limit(pageSize).lean(),
      EventLog.countDocuments(filter), EventLog.distinct('action')
    ]);
    const names = new Map(teams.map(team => [String(team._id), team.team_name]));
    res.json({ logs: logs.map(log => ({ ...log, team_name: log.team_id ? names.get(String(log.team_id)) || 'Former team' : 'Organizer' })),
      total, page, page_size: pageSize, pages: Math.max(1, Math.ceil(total / pageSize)), actions: actions.sort() });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.status ? error.message : 'Unable to load activity. Try refreshing.' });
  }
}

// Quote every cell and neutralize spreadsheet formulas in user-controlled names.
function csvCell(value) {
  let text = value == null ? '' : String(value);
  if (typeof value !== 'number' && (/^[=+\-@]/.test(text.trimStart()) || /^[\t\r\n]/.test(text))) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

async function exportLogs(req, res) {
  try {
    logFilter(req.query);
    const teams = await Team.find({}).select('_id team_name leader_name').lean();
    const filter = logFilter(req.query, teams);
    const logs = await EventLog.find(filter).select('team_id action level timestamp delta').sort({ timestamp: -1, _id: -1 }).limit(10001).lean();
    if (logs.length > 10000) return res.status(413).json({ error: 'This export exceeds 10,000 entries. Filter by team, action, or round and try again.' });
    const names = new Map(teams.map(team => [String(team._id), team.team_name]));
    const rows = [['Time (UTC)', 'Team', 'Action', 'Round', 'Score change'], ...logs.map(log => [
      new Date(log.timestamp).toISOString(), log.team_id ? names.get(String(log.team_id)) || 'Former team' : 'Organizer',
      log.action, log.level, log.delta
    ])];
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="aarambh-activity.csv"');
    res.send('\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n'));
  } catch (error) {
    res.status(error.status || 503).json({ error: error.status ? error.message : 'Unable to export activity. Try again.' });
  }
}

module.exports = { getTeams, getLogs, exportLogs, logFilter, csvCell };
