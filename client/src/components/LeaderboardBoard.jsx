import { Trophy } from 'lucide-react';
import { formatClock } from '../lib/gameClock';
import '../styles/Leaderboard.css';

const settledRounds = row => Math.max(0, Math.min(5, (row.current_level || 1) - 1));
const points = value => Number(value || 0).toLocaleString('en-IN');

function Rounds({ row }) {
  const settled = settledRounds(row);
  return <div className="rankings-progress"><span className="rankings-rounds" aria-hidden="true">{[1, 2, 3, 4, 5].map(level => {
    const status = row.round_outcomes?.find(item => item.level === level)?.status;
    return <i key={level} className={level <= settled ? status === 'skipped' ? 'is-skipped' : 'is-settled' : ''} />;
  })}</span><span>{row.completed ? 'Finished' : `${settled}/5 settled`}</span></div>;
}

// Standings shared by the public page and the organizer tab. `details` maps a
// team id to organizer-only facts (question set, live round state, session).
export default function LeaderboardBoard({ rows, details = null, podium = true, emptyText }) {
  const top = podium ? rows.slice(0, 3) : [];
  const rest = podium ? rows.slice(top.length) : rows;
  const admin = Boolean(details);
  return <>
    {top.length > 0 && <ol className="rankings-podium" aria-label="Top teams">{top.map(row => {
      const extra = details?.get(row.team_id);
      return <li key={row.team_id || row.team_name} className={`rankings-podium-card place-${row.rank}`}>
        <span className="rankings-podium-rank">{row.rank === 1 && <Trophy size={22} aria-hidden="true" />}#{row.rank}</span>
        <strong className="rankings-podium-team">{row.team_name}</strong>
        <span className="rankings-podium-points">{points(row.total_points)}<small> pts</small></span>
        <Rounds row={row} />
        {extra && <span className={`rankings-podium-meta tone-${extra.tone}`}>Set {extra.set} · {extra.state}</span>}
      </li>;
    })}</ol>}
    {rest.length > 0 && <div className="table-wrap rankings-table-wrap"><table className={`rankings-table${admin ? ' is-admin' : ''}`}>
      <caption className="sr-only">Team standings ordered by points, rounds solved and time reached</caption>
      <thead><tr><th scope="col">Rank</th><th scope="col">Team</th><th scope="col">Points</th><th scope="col">Rounds</th>
        {admin && <><th scope="col">Set</th><th scope="col">Right now</th></>}<th scope="col">Score reached</th></tr></thead>
      <tbody>{rest.map(row => {
        const extra = details?.get(row.team_id);
        return <tr key={row.team_id || row.team_name} className={row.rank === 1 ? 'rank-first' : ''}>
          <td className="rankings-rank">{row.rank === 1 && <Trophy size={20} aria-hidden="true" />}<span>{row.rank}</span></td>
          <th scope="row" className="rankings-team">{row.team_name}{extra?.session && <small className="rankings-session">{extra.session}</small>}</th>
          <td className="rankings-points">{points(row.total_points)}</td>
          <td><Rounds row={row} /></td>
          {admin && <><td className="rankings-set">{extra?.set || '—'}</td><td><span className={`rankings-state tone-${extra?.tone || 'idle'}`}>{extra?.state || '—'}</span></td></>}
          <td className="rankings-time">{row.time_taken == null ? '—' : formatClock(row.time_taken)}</td>
        </tr>;
      })}</tbody>
    </table></div>}
    {!rows.length && <p className="empty-state rankings-empty">{emptyText}</p>}
  </>;
}
