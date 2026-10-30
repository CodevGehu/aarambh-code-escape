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
      messages.push({ id: `${key}:${row.event_run_id || ''}:${level}`, team: row.team_name,
        text: level === 6 ? 'finished the five-round path!' : status === 'solved' ?
          `cleared Round ${level - 1} and reached Round ${level}!` : `reached Round ${level}!` });
    }
    return messages;
  });
}
