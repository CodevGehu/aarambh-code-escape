function progressTime(team) {
  if (!team.start_time) return null;
  const end = Number(team.current_level) >= 6 ? team.end_time : team.score_reached_at;
  if (!end) return null;
  return Math.max(0, new Date(end).getTime() - new Date(team.start_time).getTime());
}

function compareTeams(a, b) {
  const points = (Number(b.total_points) || 0) - (Number(a.total_points) || 0);
  if (points) return points;
  const solved = (team) => (team.outcomes || []).filter(outcome => outcome.status === 'solved').length;
  const solvedDifference = solved(b) - solved(a);
  if (solvedDifference) return solvedDifference;
  const aTime = a.score_reached_at ? new Date(a.score_reached_at).getTime() : null;
  const bTime = b.score_reached_at ? new Date(b.score_reached_at).getTime() : null;
  if (aTime !== null && bTime !== null && aTime !== bTime) return aTime - bTime;
  if (aTime !== null && bTime === null) return -1;
  if (bTime !== null && aTime === null) return 1;
  return String(a._id || a.team_name).localeCompare(String(b._id || b.team_name));
}

module.exports = { progressTime, compareTeams };
