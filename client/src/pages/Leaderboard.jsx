import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import LeaderboardBoard from '../components/LeaderboardBoard';
import { MilestoneShoutout, VoiceToggle } from '../components/MilestoneControls';
import api from '../lib/api';
import { useMilestones } from '../lib/milestoneVoice';
import { ArrowLeft, Maximize, Minimize, Monitor } from 'lucide-react';
import '../styles/Leaderboard.css';
export default function Leaderboard() {
  const [params, setParams] = useSearchParams(), display = params.get('display') === '1';
  const [rows, setRows] = useState(null), [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true), [error, setError] = useState(null), [updated, setUpdated] = useState(null);
  const [fullscreen, setFullscreen] = useState(false), [screenError, setScreenError] = useState('');
  const { team } = useAuth(), navigate = useNavigate();
  const { announcement, voice } = useMilestones(rows);
  useEffect(() => {
    let alive = true, refreshing = false;
    async function refresh() {
      if (refreshing) return;
      refreshing = true;
      try {
        const res = await api.get('/leaderboard');
        if (alive) { setRows(Array.isArray(res.data.leaderboard) ? res.data.leaderboard : []); setError(null); setUpdated(new Date()); }
      } catch { if (alive) setError('Connection interrupted. Showing the last saved standings; retrying automatically.'); }
      finally { refreshing = false; if (alive) setLoading(false); }
    }
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    refresh(); const interval = setInterval(refresh, 5000);
    window.addEventListener('online', refresh); document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; clearInterval(interval); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
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
  const all = rows || [], needle = search.trim().toLowerCase();
  const shown = display || !needle ? all : all.filter(row => row.team_name.toLowerCase().includes(needle));
  return <div className={`page rankings-page${display ? ' rankings-display' : ''}`}>
    {!display && <Navbar />}
    <main className="rankings-main container page-content">
      <div className="rankings-controls">
        {!display && <button className="btn btn-ghost" onClick={() => navigate(team ? '/dashboard' : '/')}><ArrowLeft size={17} />{team ? 'Back to rooms' : 'Team login'}</button>}
        <div className="rankings-screen-controls">
          <VoiceToggle voice={voice} />
          <button className="btn btn-ghost" onClick={() => setParams(display ? {} : { display: '1' })}><Monitor size={17} />{display ? 'Standard view' : 'Display view'}</button>
          {display && <button className="btn btn-ghost" onClick={toggleFullscreen}>{fullscreen ? <Minimize size={17} /> : <Maximize size={17} />}{fullscreen ? 'Exit full screen' : 'Full screen'}</button>}
        </div>
      </div>
      <header className="rankings-heading">
        <div>{display && <p className="rankings-brand">Aarambh 4.0 · Code Escape Room</p>}<h1>Leaderboard</h1><p className="muted">Points first. Ties: rounds solved, then time.</p></div>
        <p className="rankings-live"><span className={error ? 'rankings-dot is-offline' : 'rankings-dot'} />{error ? 'Reconnecting' : loading ? 'Connecting' : 'Live'}<span>{all.length} {all.length === 1 ? 'team' : 'teams'}</span></p>
      </header>
      {error && <p role="alert" className="notice notice-error rankings-error">{error}</p>}
      {screenError && <p role="status" className="muted small">{screenError}</p>}
      {!display && <label className="rankings-search" htmlFor="leaderboard-search">Find your team<input className="input" id="leaderboard-search" placeholder="Team name" value={search} onChange={event => setSearch(event.target.value)} /></label>}
      {loading ? <p className="empty-state" role="status">Loading standings…</p> :
        <LeaderboardBoard rows={shown} podium={display || !needle} emptyText={needle ? 'No matching teams. Try another name.' : 'Standings appear when the event starts.'} />}
      <footer className="rankings-footer"><p>{updated ? `Updated ${updated.toLocaleTimeString('en-IN', { timeZone: 'Asia/Calcutta' })}` : 'Waiting for standings'}</p><p>Refreshes every 5 seconds{voice.enabled ? ' · Milestone celebrations on' : ''}</p></footer>
    </main>
    <MilestoneShoutout announcement={announcement} />
  </div>;
}
