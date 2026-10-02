import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import api from '../lib/api';
import { formatClock } from '../lib/gameClock';
import { ArrowLeft, Trophy } from 'lucide-react';
export default function Leaderboard() {
  const [rows, setRows] = useState([]), [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true), [error, setError] = useState(null), [updated, setUpdated] = useState(null);
  const { team } = useAuth(); const navigate = useNavigate();
  useEffect(() => {
    let alive = true;
    async function refresh() {
      try {
        const res = await api.get('/leaderboard');
        if (alive) { setRows(res.data.leaderboard || []); setError(null); setUpdated(new Date()); }
      } catch { if (alive) setError('Live rankings are temporarily unavailable. Reconnecting…'); }
      finally { if (alive) setLoading(false); }
    }
    refresh(); const id = setInterval(refresh,5000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  const filtered = rows.filter(row => row.team_name.toLowerCase().includes(search.toLowerCase()));
  return <div className="page"><Navbar /><main className="container page-content">
    <button className="btn btn-ghost" onClick={() => navigate(team ? '/dashboard' : '/')}><ArrowLeft size={17} />{team ? 'Back to rooms' : 'Team login'}</button>
    <div className="page-heading row between" style={{ marginTop:26 }}><div><h1>Live rankings.</h1><p className="muted">Points first. Time to reach that score breaks ties.</p></div><span className="badge badge-lime"><Trophy size={17} />{rows.length} teams</span></div>
    {error && <p role="alert" className="notice notice-error" style={{ marginBottom:22 }}>{error}</p>}
    <label htmlFor="leaderboard-search" style={{ marginBottom:22 }}>Find your team<input className="input" id="leaderboard-search" placeholder="Team name" value={search} onChange={e => setSearch(e.target.value)} style={{ marginTop:8, maxWidth:460 }} /></label>
    <div className="table-wrap"><table><thead><tr><th scope="col">Rank</th><th scope="col">Team</th><th scope="col">Progress</th><th scope="col">Points</th><th scope="col">Score reached</th></tr></thead><tbody>{filtered.map(row => <tr key={row.team_id || row.team_name} className={row.rank === 1 ? 'rank-first' : ''}><td><strong>#{row.rank}</strong></td><td><strong>{row.team_name}</strong></td><td>{row.completed ? 'Path complete' : `Round ${Math.max(1,row.current_level)}`}</td><td><strong>{row.total_points}</strong></td><td>{row.time_taken == null ? '—' : formatClock(row.time_taken)}</td></tr>)}</tbody></table>{loading ? <p className="empty-state" role="status">Loading rankings…</p> : !filtered.length && <p className="empty-state">{search ? 'No matching teams. Try another name.' : 'Rankings appear when the event starts.'}</p>}</div>
    <p className="muted small" style={{ marginTop:18 }}>Updates every 5 seconds.{updated && ` Last updated ${updated.toLocaleTimeString('en-IN', { timeZone:'Asia/Calcutta' })}.`}</p>
  </main></div>;
}
