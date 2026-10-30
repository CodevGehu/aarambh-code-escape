const jwt = require('jsonwebtoken');
const { randomBytes } = require('node:crypto');
const Team = require('../models/Team');
const QuizState = require('../models/QuizState');
const { verifyAccessCode, hashAccessCode } = require('../services/accessCodes');
const { publicTeam, getEventState } = require('../services/eventRules');
const { writeActivity } = require('../services/activityLog');
const { isRosterTeam, rosterFilter } = require('../services/registrationPolicy');
const { verifyGoogleCredential } = require('../services/googleIdentity');
const { teamSessionFilter } = require('../services/teamSessions');

async function createTeamSession(team, res, identity) {
  const member = identity && identity.email !== team.email ? team.registered_members?.find(item => item.email === identity.email) : null;
  if (identity && identity.email !== team.email && !member) return res.status(401).json({ error: 'This Google account is not registered for the event.' });
  const boundSubject = member ? member.google_subject : team.google_subject;
  if (identity && boundSubject && boundSubject !== identity.subject) return res.status(401).json({ error: 'This Google account does not match the registered team member. Contact an organizer.' });
  // Narrow atomic updates preserve progress and the shared event start time.
  await Team.updateOne({ _id: team._id, current_level: 0 }, { $set: { current_level: 1 } }, { timestamps: false });
  const state = await QuizState.findOne({ key: 'global' });
  if (state?.status === 'active' && state.started_at) {
    await Team.updateOne({ _id: team._id, start_time: null }, { $set: { start_time: state.started_at } }, { timestamps: false });
    await Team.updateOne({ _id: team._id, event_run_id: { $ne: state.run_id }, round_started_at: null },
      { $set: { current_level: 1, event_run_id: state.run_id, event_open: true,
        round_started_at: state.started_at, score_reached_at: state.started_at } }, { timestamps: false });
  }
  const sessionId = randomBytes(24).toString('hex');
  const claims = { role: 'team', sid: sessionId, ...(member ? { member_email: member.email } : {}) };
  const token = jwt.sign(claims, process.env.JWT_TEAM_SECRET, {
    algorithm: 'HS256', subject: String(team._id), issuer: 'aarambh-code-escape', audience: 'participant', expiresIn: '3h'
  });
  const filter = { ...rosterFilter(), _id: team._id }, update = {};
  if (member) {
    filter.registered_members = { $elemMatch: { email: member.email, google_subject: { $in: [null, identity.subject] } } };
    update['registered_members.$.active_session_id'] = sessionId;
    update['registered_members.$.google_subject'] = identity.subject;
  } else {
    if (identity) { filter.google_subject = { $in: [null, identity.subject] }; update.google_subject = identity.subject; }
    else filter.access_code_hash = team.access_code_hash;
    update.active_session_id = sessionId;
  }
  const updated = await Team.findOneAndUpdate(filter, { $set: update }, { new: true, timestamps: false });
  if (!updated) return res.status(401).json({ error: 'Your registration or credentials changed. Contact an organizer or sign in again.' });
  await writeActivity({ team_id: updated._id, action: (member?.active_session_id || (!member && team.active_session_id)) ? 'session_replaced' : 'login', level: updated.current_level });
  const now = new Date();
  res.json({ success: true, token, team: publicTeam(updated, state, now), event: getEventState(state, now),
    participant: { email: identity?.email || team.email, name: member?.name || team.leader_name, is_leader: !member } });
}

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
    await createTeamSession(team, res);
  } catch {
    res.status(503).json({ error: 'Sign-in is temporarily unavailable. Please try again.' });
  }
};
const googleLogin = async (req, res) => {
  if (!process.env.JWT_TEAM_SECRET) return res.status(503).json({ error: 'Team authentication is not configured.' });
  try {
    const identity = await verifyGoogleCredential(req.body?.credential);
    // shortcut: first subject binding trusts the organizer-confirmed roster; add ownership challenges before accepting self-registered email lists.
    const teams = await Team.find({ ...rosterFilter(), $or: [{ email: identity.email }, { 'registered_members.email': identity.email }] })
      .select('+active_session_id +google_subject +registered_members.active_session_id +registered_members.google_subject').limit(2);
    if (teams.length !== 1 || !isRosterTeam(teams[0])) return res.status(401).json({ error: 'This Google account is not registered for the event. Contact an organizer.' });
    await createTeamSession(teams[0], res, identity);
  } catch (error) {
    res.status(error.status || 503).json({ error: error.status ? error.message : 'Sign-in is temporarily unavailable. Please try again.' });
  }
};
const getConfig = (req, res) => res.json({ google_client_id: process.env.GOOGLE_CLIENT_ID || null });
const getMe = async (req, res) => {
  try {
    const state = await QuizState.findOne({ key: 'global' });
    const now = new Date();
    const member = req.user.memberEmail && req.team.registered_members?.find(item => item.email === req.user.memberEmail);
    res.json({ team: publicTeam(req.team, state, now), event: getEventState(state, now),
      participant: { email: member?.email || req.team.email, name: member?.name || req.team.leader_name, is_leader: !member } });
  } catch {
    res.status(503).json({ error: 'Unable to restore your team. Please try again.' });
  }
};
const logout = async (req, res) => {
  try {
    const update = req.user.memberEmail ? { 'registered_members.$.active_session_id': null } : { active_session_id: null };
    await Team.updateOne({ _id: req.user.id, ...teamSessionFilter(req.user) }, { $set: update }, { timestamps: false });
    await writeActivity({ team_id: req.user.id, action: 'logout' });
    res.json({ success: true });
  } catch {
    res.status(503).json({ error: 'Unable to end the session. Please try again.' });
  }
};
module.exports = { login, googleLogin, getConfig, getMe, logout };
