const express = require('express');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Team = require('../models/Team');
const Enrollment = require('../models/AarambhEnrollment');
const QuizState = require('../models/QuizState');
const { hashAccessCode, verifyAccessCode } = require('../services/accessCodes');
const { writeActivity } = require('../services/activityLog');
const { getEventState } = require('../services/eventRules');
const router = express.Router();
const failure = (message, status = 400) => Object.assign(new Error(message), { status });

function validatePayload(body) {
  if (!body || typeof body.registration_id !== 'string' || !/^[a-f\d]{24}$/i.test(body.registration_id) ||
    !Number.isSafeInteger(body.version) || body.version < 1 || !['approved', 'revoked'].includes(body.status)) {
    throw failure('Invalid registration synchronization payload.');
  }
  const payload = { registration_id: body.registration_id.toLowerCase(), version: body.version, status: body.status };
  if (body.status === 'approved') {
    for (const field of ['team_name', 'leader_name']) {
      if (typeof body[field] !== 'string' || !body[field].trim() || body[field].length > 150) throw failure('Invalid team details.');
      payload[field] = body[field].trim();
    }
    if (typeof body.email !== 'string' || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) throw failure('Invalid leader email.');
    if (typeof body.access_code !== 'string' || body.access_code.length < 20 || body.access_code.length > 128) throw failure('Invalid team credential.');
    if (!Array.isArray(body.members) || body.members.length > 10 || body.members.some(member => typeof member !== 'string' || !member.trim() || member.length > 150)) throw failure('Invalid team members.');
    payload.email = body.email.trim().toLowerCase(); payload.access_code = body.access_code;
    payload.members = body.members.map(member => member.trim());
  }
  return payload;
}
function shouldApply(existing, payload) {
  return !existing || payload.version > existing.version ||
    (payload.version === existing.version && payload.status === 'revoked' && existing.status !== 'revoked');
}
function authenticate(req, res, next) {
  const expected = process.env.AARAMBH_INTEGRATION_SECRET;
  if (!expected || expected.length < 32) return res.status(503).json({ success: false, error: 'Registration synchronization is not configured.' });
  const header = req.headers.authorization || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!provided || provided.length > 256 || !crypto.timingSafeEqual(
    crypto.createHash('sha256').update(provided).digest(), crypto.createHash('sha256').update(expected).digest())) {
    return res.status(401).json({ success: false, error: 'Integration authorization required.' });
  }
  next();
}

async function synchronize(payload) {
  // The receipt and team change commit together; stale approvals cannot undo a refund.
  const newHash = payload.status === 'approved' ? await hashAccessCode(payload.access_code) : null;
  let result;
  await mongoose.connection.transaction(async session => {
    const enrollment = await Enrollment.findById(payload.registration_id).session(session);
    if (!shouldApply(enrollment, payload)) {
      result = { success: true, applied: false, status: enrollment.status, version: enrollment.version, team_id: enrollment.team_id };
      return;
    }
    let team = await Team.findOne({ aarambh_registration_id: payload.registration_id }).select('+access_code_hash').session(session);
    if (payload.status === 'approved') {
      const state = await QuizState.findOne({ key: 'global' }).session(session);
      if (['starting', 'resetting'].includes(state?.status)) throw failure('Event setup is in progress; retry synchronization.', 503);
      if (!team) {
        team = await Team.findOne({ email: payload.email }).select('+access_code_hash').session(session);
        if (team && (team.aarambh_registration_id || team.start_time || team.total_points !== 0 || team.outcomes?.length)) {
          throw failure('This leader already belongs to another event team. Contact an organizer.', 409);
        }
      }
      if (team) {
        const changedCode = !await verifyAccessCode(payload.access_code, team.access_code_hash);
        // Do not replace scores, assignments, timers or histories during roster synchronization.
        const update = { aarambh_registration_id: payload.registration_id, access_enabled: true,
          team_name: payload.team_name, leader_name: payload.leader_name, email: payload.email, members: payload.members };
        if (changedCode) Object.assign(update, { access_code_hash: newHash, active_session_id: null });
        await Team.updateOne({ _id: team._id }, { $set: update }, { session, timestamps: false });
      } else {
        const active = getEventState(state).status === 'active';
        [team] = await Team.create([{ team_name: payload.team_name, leader_name: payload.leader_name,
          email: payload.email, members: payload.members, access_code_hash: newHash, access_enabled: true,
          aarambh_registration_id: payload.registration_id,
          ...(active ? { current_level: 1, start_time: state.started_at, round_started_at: state.started_at,
            event_run_id: state.run_id, event_open: true, score_reached_at: state.started_at } : {}) }], { session });
      }
    } else if (team) {
      await Team.updateOne({ _id: team._id }, { $set: { access_enabled: false, active_session_id: null },
        $inc: { progress_version: 1 } }, { session, timestamps: false });
    }
    await Enrollment.updateOne({ _id: payload.registration_id }, { $set: { version: payload.version,
      status: payload.status, team_id: team?._id || enrollment?.team_id || null } }, { upsert: true, session });
    result = { success: true, applied: true, status: payload.status, version: payload.version, team_id: team?._id || null };
  });
  if (result.applied) await writeActivity({ team_id: result.team_id,
    action: result.status === 'approved' ? 'registration_approved' : 'registration_revoked',
    metadata: { registration_id: payload.registration_id, version: payload.version } });
  return result;
}
router.post('/teams', authenticate, async (req, res) => {
  try {
    const payload = validatePayload(req.body);
    // A duplicate unique receipt can race on the first request; reload its committed version once.
    let result;
    try { result = await synchronize(payload); }
    catch (error) { if (error.code !== 11000) throw error; result = await synchronize(payload); }
    res.json(result);
  } catch (error) {
    res.status(error.status || (error.code === 11000 ? 409 : 503)).json({ success: false,
      error: error.status ? error.message : 'Registration synchronization could not complete. Retry shortly.' });
  }
});
module.exports = { router, validatePayload, shouldApply, authenticate, synchronize };
