const { randomUUID } = require('node:crypto');
const EventLog = require('../models/EventLog');

// Callers supply structured facts only: never answer text, tokens, or access codes.
// Score/outcome history is already committed atomically on Team before this write.
async function writeActivity(payload) {
  try {
    const entry = { event_id: randomUUID(), timestamp: new Date(), ...payload };
    await EventLog.updateOne({ event_id: entry.event_id }, { $setOnInsert: entry }, { upsert: true, maxTimeMS: 2000 });
    return true;
  } catch {
    console.error('[EVENT_LOG] Secondary log write failed; authoritative team history is preserved.');
    return false;
  }
}
async function recordObservedTimeouts(teams, state, now = new Date()) {
  if (!state?.run_id) return;
  const { getEventState, getRoundState } = require('./eventRules');
  const event = getEventState(state, now);
  const globalDeadline = event.deadline && new Date(event.deadline);
  const manualEnd = state.status === 'ended' && state.ended_at && new Date(state.ended_at) < globalDeadline;
  if (globalDeadline && now >= globalDeadline && !manualEnd) {
    await writeActivity({ event_id: `${state.run_id}:event_deadline`, action: 'event_deadline',
      timestamp: globalDeadline, metadata: { run_id: state.run_id } });
  }
  const effectiveNow = event.status === 'ended' && event.ended_at ? new Date(Math.min(now.getTime(), new Date(event.ended_at).getTime())) : now;
  await Promise.all(teams.map(async team => {
    const round = getRoundState(team, state, now);
    const candidates = [...(round ? [{ level: round.level, deadline: round.deadline, observed: effectiveNow }] : []),
      ...(team.outcomes || []).map(outcome => ({ level: outcome.level, deadline: outcome.round_deadline, observed: outcome.timestamp }))];
    await Promise.all(candidates.filter(item => item.deadline && new Date(item.observed) >= new Date(item.deadline)).map(item =>
      writeActivity({ event_id: `${state.run_id}:${team._id}:round:${item.level}:deadline`,
        team_id: team._id, action: 'round_timeout', level: item.level, timestamp: new Date(item.deadline),
        metadata: { run_id: state.run_id } })));
  }));
}
module.exports = { writeActivity, recordObservedTimeouts };
