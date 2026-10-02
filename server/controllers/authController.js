const jwt = require('jsonwebtoken');
const { randomBytes } = require('node:crypto');
const Team = require('../models/Team');
const QuizState = require('../models/QuizState');
const { verifyAccessCode, hashAccessCode } = require('../services/accessCodes');
const { publicTeam, getEventState } = require('../services/eventRules');
const { writeActivity } = require('../services/activityLog');
const { isRosterTeam, rosterFilter } = require('../services/registrationPolicy');

let dummyHash;
const login = async (req, res) => {
  if (!process.env.JWT_TEAM_SECRET) return res.status(503).json({ error: 'Team authentication is not configured.' });
  const { email, accessCode } = req.body || {};
  if (typeof email !== 'string' || email.length > 254 || typeof accessCode !== 'string' || accessCode.length < 1 || accessCode.length > 128) {
    return res.status(400).json({ error: 'Enter your registered leader email and access code.' });
  }
  try {
    const team = await Team.findOne({ email: email.toLowerCase().trim() }).select('+access_code_hash +active_session_id');
    // Unknown emails receive the same expensive hash check and generic response.
    if (!dummyHash) dummyHash = hashAccessCode(randomBytes(24).toString('hex'));
    const valid = await verifyAccessCode(accessCode.trim(), team?.access_code_hash || await dummyHash);
    if (!valid || !isRosterTeam(team)) {
      if (team) await writeActivity({ team_id: team._id, action: 'login_failed' });
      return res.status(401).json({ error: 'Incorrect leader email or access code.' });
    }
    // Narrow atomic updates preserve progress and the shared event start time.
    await Team.updateOne({ _id: team._id, current_level: 0 }, { $set: { current_level: 1 } }, { timestamps: false });
    const state = await QuizState.findOne({ key: 'global' });
    if (state?.status === 'active' && state.started_at) {
      await Team.updateOne({ _id: team._id, start_time: null }, { $set: { start_time: state.started_at } }, { timestamps: false });
      // A payment sync may finish while the organizer is initializing the shared start.
      await Team.updateOne({ _id: team._id, event_run_id: { $ne: state.run_id }, round_started_at: null },
        { $set: { current_level: 1, event_run_id: state.run_id, event_open: true,
          round_started_at: state.started_at, score_reached_at: state.started_at } }, { timestamps: false });
    }
    const sessionId = randomBytes(24).toString('hex');
    const token = jwt.sign({ role: 'team', sid: sessionId }, process.env.JWT_TEAM_SECRET, {
      algorithm: 'HS256', subject: String(team._id), issuer: 'aarambh-code-escape', audience: 'participant', expiresIn: '3h'
    });
    const updated = await Team.findOneAndUpdate(
      { ...rosterFilter(), _id: team._id, access_code_hash: team.access_code_hash },
      { $set: { active_session_id: sessionId } }, { new: true, timestamps: false }
    );
    if (!updated) return res.status(401).json({ error: 'Access code changed. Please sign in again.' });
    await writeActivity({ team_id: updated._id, action: team.active_session_id ? 'session_replaced' : 'login', level: updated.current_level });
    const now = new Date();
    res.json({ success: true, token, team: publicTeam(updated, state, now), event: getEventState(state, now) });
  } catch {
    res.status(503).json({ error: 'Sign-in is temporarily unavailable. Please try again.' });
  }
};
const getMe = async (req, res) => {
  try {
    const state = await QuizState.findOne({ key: 'global' });
    const now = new Date();
    res.json({ team: publicTeam(req.team, state, now), event: getEventState(state, now) });
  } catch {
    res.status(503).json({ error: 'Unable to restore your team. Please try again.' });
  }
};
const logout = async (req, res) => {
  try {
    await Team.updateOne({ _id: req.user.id, active_session_id: req.user.sessionId }, { $set: { active_session_id: null } }, { timestamps: false });
    await writeActivity({ team_id: req.user.id, action: 'logout' });
    res.json({ success: true });
  } catch {
    res.status(503).json({ error: 'Unable to end the session. Please try again.' });
  }
};
module.exports = { login, getMe, logout };
