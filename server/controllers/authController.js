const jwt = require('jsonwebtoken');
const { randomBytes } = require('node:crypto');
const Team = require('../models/Team');
const QuizState = require('../models/QuizState');
const { verifyAccessCode, hashAccessCode } = require('../services/accessCodes');

function publicTeam(team) {
  return {
    _id: team._id, team_name: team.team_name, leader_name: team.leader_name,
    email: team.email, members: team.members, question_set_id: team.question_set_id,
    current_level: team.current_level, total_points: team.total_points,
    level_points: team.level_points || {}, start_time: team.start_time, end_time: team.end_time
  };
}
let dummyHash;
const login = async (req, res) => {
  if (!process.env.JWT_TEAM_SECRET) return res.status(503).json({ error: 'Team authentication is not configured.' });
  const { email, accessCode } = req.body || {};
  if (typeof email !== 'string' || email.length > 254 || typeof accessCode !== 'string' || accessCode.length < 1 || accessCode.length > 128) {
    return res.status(400).json({ error: 'Enter your registered leader email and access code.' });
  }
  try {
    const team = await Team.findOne({ email: email.toLowerCase().trim() }).select('+access_code_hash');
    // Unknown emails receive the same expensive hash check and generic response.
    if (!dummyHash) dummyHash = hashAccessCode(randomBytes(24).toString('hex'));
    const valid = await verifyAccessCode(accessCode.trim(), team?.access_code_hash || await dummyHash);
    if (!team || !valid) return res.status(401).json({ error: 'Incorrect leader email or access code.' });
    // Narrow atomic updates preserve progress and the shared event start time.
    await Team.updateOne({ _id: team._id, current_level: 0 }, { $set: { current_level: 1 } }, { timestamps: false });
    const state = await QuizState.findOne({ key: 'global' });
    if (state?.status === 'active' && state.started_at) {
      await Team.updateOne({ _id: team._id, start_time: null }, { $set: { start_time: state.started_at } }, { timestamps: false });
    }
    const sessionId = randomBytes(24).toString('hex');
    const token = jwt.sign({ role: 'team', sid: sessionId }, process.env.JWT_TEAM_SECRET, {
      algorithm: 'HS256', subject: String(team._id), issuer: 'aarambh-code-escape', audience: 'participant', expiresIn: '3h'
    });
    const updated = await Team.findOneAndUpdate(
      { _id: team._id, access_code_hash: team.access_code_hash },
      { $set: { active_session_id: sessionId } }, { new: true, timestamps: false }
    );
    if (!updated) return res.status(401).json({ error: 'Access code changed. Please sign in again.' });
    res.json({ success: true, token, team: publicTeam(updated) });
  } catch {
    res.status(503).json({ error: 'Sign-in is temporarily unavailable. Please try again.' });
  }
};
const getMe = async (req, res) => res.json({ team: publicTeam(req.team) });
const logout = async (req, res) => {
  try {
    await Team.updateOne({ _id: req.user.id, active_session_id: req.user.sessionId }, { $set: { active_session_id: null } }, { timestamps: false });
    res.json({ success: true });
  } catch {
    res.status(503).json({ error: 'Unable to end the session. Please try again.' });
  }
};
module.exports = { login, getMe, logout };
