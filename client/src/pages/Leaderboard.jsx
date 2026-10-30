import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import api from '../lib/api';
import { formatClock } from '../lib/gameClock';
import { roundAnnouncements } from '../lib/leaderboardAnnouncements';
import { ArrowLeft, Maximize, Minimize, Monitor, Trophy } from 'lucide-react';
import '../styles/Leaderboard.css';
export default function Leaderboard() {
  const [params, setParams] = useSearchParams(), display = params.get('display') === '1';
  const [rows, setRows] = useState([]), [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true), [error, setError] = useState(null), [updated, setUpdated] = useState(null);
  const [announcements, setAnnouncements] = useState([]), [fullscreen, setFullscreen] = useState(false), [screenError, setScreenError] = useState('');
  const previous = useRef(null);
  const { team } = useAuth(), navigate = useNavigate();
  useEffect(() => {
    let alive = true, refreshing = false;
    async function refresh() {
      if (refreshing) return;
      refreshing = true;
      try {
        const res = await api.get('/leaderboard');
        if (alive) {
          const next = Array.isArray(res.data.leaderboard) ? res.data.leaderboard : [];
          const advances = roundAnnouncements(previous.current, next);
          previous.current = next;
          setRows(next); setError(null); setUpdated(new Date());
          if (advances.length) setAnnouncements(queue => [...queue, ...advances]);
        }
      } catch { if (alive) setError('Connection interrupted. Showing the last saved standings; retrying automatically.'); }
      finally { refreshing = false; if (alive) setLoading(false); }
    }
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    refresh(); const interval = setInterval(refresh, 5000);
    window.addEventListener('online', refresh); document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; clearInterval(interval); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  const announcement = announcements[0];
  useEffect(() => {
    if (!announcement) return;
    const timeout = setTimeout(() => setAnnouncements(queue => queue.slice(1)), 5000);
    return () => clearTimeout(timeout);
  }, [announcement?.id]);
  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    update();
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  async function toggleFullscreen() {
    setScreenError('');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else setScreenError('Use your browser’s full-screen option for this display.');
    } catch { setScreenError('Full screen was blocked. Use your browser’s full-screen option.'); }
  }
  const filtered = rows.filter(row => row.team_name.toLowerCase().includes(search.trim().toLowerCase()));
  return <div className={`page rankings-page${display ? ' rankings-display' : ''}`}>
    {!display && <Navbar />}
    <main className="rankings-main container page-content">
      <div className="rankings-controls">
        {!display && <button className="btn btn-ghost" onClick={() => navigate(team ? '/dashboard' : '/')}><ArrowLeft size={17} />{team ? 'Back to rooms' : 'Team login'}</button>}
        <div className="rankings-screen-controls">
          <button className="btn btn-ghost" onClick={() => setParams(display ? {} : { display: '1' })}><Monitor size={17} />{display ? 'Standard view' : 'Display view'}</button>
          {display && <button className="btn btn-ghost" onClick={toggleFullscreen}>{fullscreen ? <Minimize size={17} /> : <Maximize size={17} />}{fullscreen ? 'Exit full screen' : 'Full screen'}</button>}
        </div>
      </div>
      <header className="rankings-heading">
        <div>{display && <p className="rankings-brand">Aarambh 4.0 · Code Escape Room</p>}<h1>Leaderboard</h1><p className="muted">Points first. Ties: rounds solved, then time.</p></div>
        <p className="rankings-live"><span className={error ? 'rankings-dot is-offline' : 'rankings-dot'} />{error ? 'Reconnecting' : loading ? 'Connecting' : 'Live'}<span>{rows.length} {rows.length === 1 ? 'team' : 'teams'}</span></p>
      </header>
      {error && <p role="alert" className="notice notice-error rankings-error">{error}</p>}
      {screenError && <p role="status" className="muted small">{screenError}</p>}
      {!display && <label className="rankings-search" htmlFor="leaderboard-search">Find your team<input className="input" id="leaderboard-search" placeholder="Team name" value={search} onChange={event => setSearch(event.target.value)} /></label>}
      <div className="table-wrap rankings-table-wrap"><table className="rankings-table"><caption className="sr-only">Team standings ordered by points, rounds solved and time reached</caption><thead><tr><th scope="col">Rank</th><th scope="col">Team</th><th scope="col">Points</th><th scope="col">Rounds</th><th scope="col">Score reached</th></tr></thead><tbody>{(display ? rows : filtered).map(row => {
        const settled = Math.max(0, Math.min(5, (row.current_level || 1) - 1));
        return <tr key={row.team_id || row.team_name} className={row.rank === 1 ? 'rank-first' : ''}>
          <td className="rankings-rank">{row.rank === 1 && <Trophy size={20} aria-hidden="true" />}<span>{row.rank}</span></td>
          <th scope="row" className="rankings-team">{row.team_name}</th>
          <td className="rankings-points">{row.total_points.toLocaleString('en-IN')}</td>
          <td><div className="rankings-progress"><span className="rankings-rounds" aria-hidden="true">{[1, 2, 3, 4, 5].map(level => <i key={level} className={level <= settled ? 'is-settled' : ''} />)}</span><span>{row.completed ? 'Finished' : `${settled}/5 settled`}</span></div></td>
          <td className="rankings-time">{row.time_taken == null ? '—' : formatClock(row.time_taken)}</td>
        </tr>;
      })}</tbody></table>{loading ? <p className="empty-state" role="status">Loading standings…</p> : !(display ? rows : filtered).length && <p className="empty-state">{!display && search ? 'No matching teams. Try another name.' : 'Standings appear when the event starts.'}</p>}</div>
      <footer className="rankings-footer"><p>{updated ? `Updated ${updated.toLocaleTimeString('en-IN', { timeZone: 'Asia/Calcutta' })}` : 'Waiting for standings'}</p><p>Refreshes every 5 seconds</p></footer>
    </main>
    {announcement && <div className="rankings-shoutout" role="status" aria-live="polite" aria-atomic="true"><Trophy size={30} aria-hidden="true" /><p><strong>{announcement.team}</strong> {announcement.text}</p></div>}
  </div>;
}
