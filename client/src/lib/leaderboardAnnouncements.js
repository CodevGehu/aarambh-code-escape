export function roundAnnouncements(previous, current) {
  if (!previous) return [];
  const before = new Map(previous.map(row => [row.team_id || row.team_name, row]));
  return current.flatMap(row => {
    const key = row.team_id || row.team_name, old = before.get(key);
    if (!old || old.event_run_id !== row.event_run_id || row.current_level <= old.current_level) return [];
    const messages = [];
    for (let level = Math.max(2, old.current_level + 1); level <= Math.min(6, row.current_level); level++) {
      const outcome = row.round_outcomes?.find(item => item.level === level - 1);
      const status = outcome?.status || (level === row.current_level ? row.last_outcome_status : null);
      messages.push({ id: `${key}:${row.event_run_id || ''}:${level}`, team: row.team_name, level, status: status || null,
        text: level === 6 ? 'finished the five-round path!' : status === 'solved' ?
          `cleared Round ${level - 1} and reached Round ${level}!` : `reached Round ${level}!` });
    }
    return messages;
  });
}

const solvedLevel = (row, level) => (row.round_outcomes || []).some(item => item.level === level && item.status === 'solved');
const leaderOf = rows => rows.find(row => row.rank === 1) || null;

// Round advances plus the moments worth saying out loud. `speech` is null for
// moves that are shown but not voiced (skips), so no team is called out for one.
export function milestoneAnnouncements(previous, current) {
  if (!previous) return [];
  const firstClaimed = new Set();
  const items = roundAnnouncements(previous, current).map(item => {
    const cleared = item.level - 1;
    if (item.level === 6) return { ...item, kind: 'finish',
      speech: item.status === 'solved' ? `${item.team} escaped all five rooms!` : `${item.team} has finished the escape route.` };
    if (item.status !== 'solved') return { ...item, kind: 'advance', speech: null };
    const first = !firstClaimed.has(cleared) && !previous.some(row => solvedLevel(row, cleared));
    if (first) firstClaimed.add(cleared);
    return { ...item, kind: first ? 'first' : 'cleared',
      text: first ? `is the first team to clear Round ${cleared}!` : item.text,
      speech: first ? `${item.team} is the first team to clear round ${cleared}!` : `${item.team} cleared round ${cleared}.` };
  });
  const oldLeader = leaderOf(previous), newLeader = leaderOf(current);
  const leaderKey = row => row && (row.team_id || row.team_name);
  if (oldLeader && newLeader && leaderKey(oldLeader) !== leaderKey(newLeader) && newLeader.total_points > 0
    && oldLeader.event_run_id === newLeader.event_run_id) {
    items.push({ id: `${leaderKey(newLeader)}:${newLeader.event_run_id || ''}:lead:${newLeader.total_points}`, team: newLeader.team_name,
      kind: 'lead', text: 'takes the lead!', speech: `${newLeader.team_name} takes the lead!` });
  }
  return items;
}
