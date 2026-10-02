const MINUTE = 60000;
const DEFAULTS = Object.freeze({ duration_minutes: 120, round_minutes: [10, 15, 20, 25, 30],
  round_points: [100, 200, 300, 400, 500], overtime_decay_percent_per_minute: 5,
  minimum_reward_percent: 25, skip_penalty_percent: 20 });
const defaultConfig = () => structuredClone(DEFAULTS);

function validateConfig(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Settings must be an object.');
  for (const key of Object.keys(input)) if (!Object.hasOwn(DEFAULTS, key)) throw new Error(`Unknown setting: ${key}`);
  const config = { ...defaultConfig(), ...input };
  if (config.duration_minutes !== 120) throw new Error('The event duration is fixed at 120 minutes.');
  for (const key of ['round_minutes', 'round_points']) {
    if (!Array.isArray(config[key]) || config[key].length !== 5 || config[key].some(value =>
      typeof value !== 'number' || !Number.isFinite(value) || value <= 0 ||
      (key === 'round_points' && (!Number.isSafeInteger(value) || value > Number.MAX_SAFE_INTEGER / 5)))) throw new Error(`${key} needs five positive values.`);
  }
  if (config.round_minutes.reduce((sum, value) => sum + value, 0) > 120) throw new Error('Round allowances cannot exceed the 120-minute event.');
  for (const key of ['overtime_decay_percent_per_minute', 'minimum_reward_percent', 'skip_penalty_percent']) {
    if (typeof config[key] !== 'number' || !Number.isFinite(config[key]) || config[key] < 0 || config[key] > 100) throw new Error(`${key} must be between 0 and 100.`);
  }
  return config;
}
const getConfig = state => validateConfig(state?.frozen_config || state?.config || {});
const dateMs = value => value ? new Date(value).getTime() : null;

function getEventState(state, now = new Date()) {
  const config = getConfig(state);
  const start = dateMs(state?.started_at);
  const deadline = dateMs(state?.deadline) ?? (start == null ? null : start + config.duration_minutes * MINUTE);
  let status = state?.status || 'not_started';
  if (status === 'active' && (deadline == null || now.getTime() >= deadline)) status = 'ended';
  const storedEnd = dateMs(state?.ended_at);
  const effectiveEnd = status === 'ended' ? Math.min(storedEnd ?? Infinity, deadline ?? Infinity) : null;
  return { status, started_at: state?.started_at || null,
    ended_at: effectiveEnd != null && Number.isFinite(effectiveEnd) ? new Date(effectiveEnd) : null,
    deadline: deadline == null ? null : new Date(deadline), server_now: now, config };
}

function getRoundState(team, state, now = new Date()) {
  const level = team.current_level;
  if (!Number.isInteger(level) || level < 1 || level > 5) return null;
  const event = getEventState(state, now);
  const config = event.config;
  const clock = event.status === 'ended' ? Math.min(now.getTime(), dateMs(event.ended_at) ?? dateMs(event.deadline) ?? now.getTime()) : now.getTime();
  const started = dateMs(team.round_started_at) ?? dateMs(state?.started_at);
  const base = config.round_points[level - 1];
  const carry = Math.max(0, team.carry_ms || 0);
  const deadline = started == null ? null : Math.min(started + config.round_minutes[level - 1] * MINUTE + carry,
    dateMs(event.deadline) ?? Infinity);
  const overtime = deadline == null ? 0 : Math.max(0, clock - deadline);
  const expired = deadline != null && clock >= deadline;
  const fraction = Math.max(config.minimum_reward_percent / 100,
    1 - config.overtime_decay_percent_per_minute / 100 * overtime / MINUTE);
  return { level, started_at: started == null ? null : new Date(started),
    deadline: deadline == null ? null : new Date(deadline), carry_ms: carry,
    remaining_ms: deadline == null ? null : Math.max(0, deadline - clock),
    overtime_ms: overtime, requires_decision: event.status === 'active' && expired && !team.overtime_continued_at,
    continued: Boolean(team.overtime_continued_at), available_points: Math.max(Math.ceil(base * config.minimum_reward_percent / 100), Math.floor(base * fraction + 1e-9)),
    base_points: base, skip_penalty: Math.ceil(base * config.skip_penalty_percent / 100),
    can_skip: event.status === 'active' && expired, event_ended: event.status === 'ended' };
}

function publicTeam(team, state, now = new Date()) {
  return { _id: team._id, team_name: team.team_name, leader_name: team.leader_name, email: team.email,
    members: team.members || [], question_set_id: team.question_set_id, current_level: team.current_level,
    total_points: team.total_points, level_points: team.level_points || {}, start_time: team.start_time || null,
    end_time: team.end_time || null, score_reached_at: team.score_reached_at || null,
    outcomes: team.outcomes || [], progress_version: team.progress_version || 0,
    round: getRoundState(team, state, now) };
}

function outcomeUpdate(team, state, action, now = new Date()) {
  if (!['solved', 'skipped'].includes(action)) throw Object.assign(new Error('Invalid round action.'), { code: 'INVALID_ACTION' });
  const round = getRoundState(team, state, now);
  if (getEventState(state, now).status !== 'active') throw Object.assign(new Error('The event has ended or is inactive.'), { code: 'EVENT_ENDED' });
  if (!round) throw Object.assign(new Error('No active round.'), { code: 'NO_ACTIVE_ROUND' });
  if (action === 'solved' && round.requires_decision) throw Object.assign(new Error('Choose Continue or Skip before answering in overtime.'), { code: 'OVERTIME_DECISION_REQUIRED' });
  if (action === 'skipped' && !round.can_skip) throw Object.assign(new Error('Skipping is available only after this round time expires.'), { code: 'SKIP_NOT_AVAILABLE' });
  const points = action === 'skipped' ? -round.skip_penalty : round.available_points;
  const carry = action === 'skipped' || round.overtime_ms > 0 ? 0 : round.remaining_ms;
  const completed = team.current_level === 5;
  const outcome = { id: require('node:crypto').randomUUID(), level: team.current_level, status: action,
    points, timestamp: now, completed_at: now, before: team.total_points || 0, after: (team.total_points || 0) + points,
    carry_ms: carry, overtime_ms: round.overtime_ms, available_points: round.available_points, round_deadline: round.deadline };
  return { outcome, update: {
    $inc: { total_points: points, progress_version: 1 },
    $set: { current_level: completed ? 6 : team.current_level + 1,
      [`level_points.${team.current_level}`]: points, round_started_at: completed ? null : now,
      carry_ms: completed ? 0 : carry, overtime_continued_at: null, score_reached_at: now,
      ...(completed ? { end_time: now } : {}) },
    $push: { outcomes: outcome }
  } };
}
module.exports = { defaultConfig, validateConfig, getConfig, getEventState, getRoundState, publicTeam, outcomeUpdate };
