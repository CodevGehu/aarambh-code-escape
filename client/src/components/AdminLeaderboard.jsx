import { useMemo } from 'react';
import { ExternalLink, Megaphone } from 'lucide-react';
import LeaderboardBoard from './LeaderboardBoard';
import { MilestoneShoutout, VoiceToggle } from './MilestoneControls';
import { formatClock } from '../lib/gameClock';
import { useMilestones } from '../lib/milestoneVoice';

function progressTime(team) {
  if (!team.start_time) return null;
  const end = team.current_level >= 6 ? team.end_time : team.score_reached_at;
  return end ? Math.max(0, new Date(end).getTime() - new Date(team.start_time).getTime()) : null;
}

function roundState(team, status, now, endedAt) {
  const level = Math.max(1, team.current_level || 1), round = team.round || {};
  if (team.current_level >= 6) return { state: 'Finished', tone: 'done' };
  if (status === 'not_started' || status === 'starting') return { state: 'Waiting for start', tone: 'idle' };
  const deadline = round.deadline ? new Date(round.deadline).getTime() : null;
  if (!deadline) return { state: status === 'ended' ? 'Stopped' : `Round ${level}`, tone: 'idle' };
  const remaining = deadline - (status === 'active' ? now : endedAt || now);
  if (status === 'ended') return { state: `Stopped in round ${level}`, tone: 'idle' };
  if (remaining > 0) return { state: `Round ${level} · ${formatClock(remaining)} left`, tone: 'live' };
  if (round.requires_decision) return { state: `Round ${level} · continue or skip`, tone: 'decision' };
  return { state: `Round ${level} · +${formatClock(-remaining)} overtime`, tone: 'overtime' };
}

// Organizer view of the same standings players see, plus each team's question
// set, live round clock and sign-in state. Revoked teams are left out.
export default function AdminLeaderboard({ teams, status, now, endedAt }) {
  const rows = useMemo(() => teams.filter(team => team.rank != null).sort((a, b) => a.rank - b.rank).map(team => ({
    rank: team.rank, team_id: String(team._id), team_name: team.team_name, total_points: team.total_points || 0,
    current_level: team.current_level, completed: team.current_level >= 6, time_taken: progressTime(team),
    round_outcomes: (team.outcomes || []).map(outcome => ({ level: outcome.level, status: outcome.status }))
  })), [teams]);
  const { announcement, voice } = useMilestones(rows);
  const ended = endedAt ? new Date(endedAt).getTime() : null;
  const details = new Map(teams.map(team => [String(team._id), { set: team.question_set_id || '—',
    session: team.access_enabled === false ? 'Access revoked' : team.session_active ? 'Signed in' : 'Not signed in',
    ...roundState(team, status, now, ended) }]));
  const finished = rows.filter(row => row.completed).length;
  return <section className="admin-panel admin-leaderboard" aria-label="Leaderboard">
    <div className="admin-section-title"><div><h2>Leaderboard</h2><p>{rows.length} teams · {finished} finished · the same order players see. Ties use solved rounds, then the earliest time a score was reached.</p></div>
      <div className="admin-leaderboard-actions"><VoiceToggle voice={voice} className="admin-button" />{voice.supported && <button type="button" className="admin-button" onClick={voice.preview} title="Plays each celebration in turn: cleared, first, new leader, finished"><Megaphone size={16} /> Test sound</button>}
        <a className="admin-button" href="/leaderboard?display=1" target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> Open display screen</a></div></div>
    <LeaderboardBoard rows={rows} details={details} emptyText="No teams on the roster yet. Add the event roster before starting." />
    <p className="admin-leaderboard-note">Milestones (every cleared round, the first team out of each round, a new leader, a team escaping all five rooms) pop up here and on the display screen. Turn the sound on for a victory jingle and applause with confetti; bigger moments get bigger celebrations. Skips are shown quietly, with no sound or confetti. Use Test sound to check the speakers.</p>
    <MilestoneShoutout announcement={announcement} />
  </section>;
}
