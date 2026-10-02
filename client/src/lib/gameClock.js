import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function formatClock(ms) {
  const seconds = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
  const h = Math.floor(seconds / 3600), m = Math.floor(seconds % 3600 / 60), s = seconds % 60;
  return `${h > 0 ? `${String(h).padStart(2, '0')}:` : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
export function useGameClock({ poll = false } = {}) {
  const { team, event, error, refreshTeam } = useAuth();
  const [localNow, setLocalNow] = useState(Date.now());
  const offset = useMemo(() => event?.server_now ? Date.parse(event.server_now) - Date.now() : 0, [event?.server_now]);
  useEffect(() => {
    const tick = setInterval(() => setLocalNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);
  useEffect(() => {
    if (!poll || !team?._id) return;
    refreshTeam();
    const pollTimer = setInterval(refreshTeam, 5000);
    const onVisible = () => { if (document.visibilityState === 'visible') refreshTeam(); };
    window.addEventListener('online', refreshTeam); document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(pollTimer); window.removeEventListener('online', refreshTeam); document.removeEventListener('visibilitychange', onVisible); };
  }, [refreshTeam, poll, team?._id]);
  const now = localNow + offset;
  const round = team?.round;
  const eventRemaining = event?.deadline ? Math.max(0, Date.parse(event.deadline) - now) : null;
  const roundRemaining = round?.deadline ? Math.max(0, Date.parse(round.deadline) - now) : null;
  const overtime = round?.deadline ? Math.max(0, now - Date.parse(round.deadline)) : 0;
  const expired = round?.deadline ? now >= Date.parse(round.deadline) : false;
  const ended = event?.status === 'ended' || (event?.status === 'active' && eventRemaining === 0);
  const decision = expired && !round?.continued && !ended;
  const config = event?.config;
  const availablePoints = round && config ? Math.max(Math.ceil(round.base_points * config.minimum_reward_percent / 100),
    Math.floor(round.base_points * Math.max(config.minimum_reward_percent / 100,
      1 - config.overtime_decay_percent_per_minute / 100 * overtime / 60000) + 1e-9)) : round?.available_points;
  return { team, event, round, now, eventRemaining, roundRemaining, overtime, expired, ended, decision, error, availablePoints };
}
