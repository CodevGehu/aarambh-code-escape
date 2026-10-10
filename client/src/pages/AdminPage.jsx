import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, ArrowLeft, Download, LockKeyhole, Play, RefreshCw, Settings2, Square, X } from 'lucide-react';
import api from '../lib/api';
import '../styles/AdminPage.css';

const defaults = { duration_minutes: 120, round_minutes: [10, 15, 20, 25, 30], round_points: [100, 200, 300, 400, 500], overtime_decay_percent_per_minute: 5, minimum_reward_percent: 25, skip_penalty_percent: 20 };
const readable = value => String(value || '').replace(/_/g, ' ');
const dateTime = value => value ? new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
const clock = milliseconds => {
  const seconds = Math.ceil(Math.max(0, milliseconds || 0) / 1000);
  return `${Math.floor(seconds / 3600) ? `${Math.floor(seconds / 3600)}:` : ''}${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(Boolean(sessionStorage.getItem('adminToken')));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [teams, setTeams] = useState([]);
  const [event, setEvent] = useState(null);
  const [logs, setLogs] = useState({ logs: [], page: 1, pages: 1, total: 0, actions: [] });
  const [filters, setFilters] = useState({ team_id: '', action: '', level: '', search: '', page: 1 });
  const [search, setSearch] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [confirmEnd, setConfirmEnd] = useState(false);
  const endDialog = useRef(null);
  const ledger = useRef(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [offset, setOffset] = useState(0);
  const [config, setConfig] = useState(defaults);
  const [configDirty, setConfigDirty] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const refreshing = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    if (sessionStorage.getItem('adminToken')) {
      api.get('/admin/verify').then(() => { if (mounted.current) setAuthenticated(true); })
        .catch(err => {
          if (err.response?.status === 401) sessionStorage.removeItem('adminToken');
          if (mounted.current) setError(err.response?.data?.error || 'Unable to restore the organizer session. Try signing in again.');
        }).finally(() => { if (mounted.current) setChecking(false); });
    }
    return () => { mounted.current = false; clearInterval(interval); };
  }, []);

  const handleFailure = useCallback(err => {
    if (!mounted.current) return;
    if (err.response?.status === 401) {
      sessionStorage.removeItem('adminToken');
      setAuthenticated(false);
    }
    setError(err.response?.data?.error || 'Unable to reach the event server. Check your connection and refresh.');
  }, []);

  async function signOut() {
    if (busy) return;
    setBusy('signout');setError('');
    try {
      await api.post('/admin/logout');
      sessionStorage.removeItem('adminToken');
      window.dispatchEvent(new Event('admin-session-ended'));
      setAuthenticated(false);
    } catch (err) { handleFailure(err); }
    finally { setBusy(''); }
  }

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const [teamResponse, logResponse] = await Promise.all([
        api.get('/admin/teams'), api.get('/admin/logs', { params: filters })
      ]);
      if (!mounted.current) return;
      setTeams(teamResponse.data.teams);
      setEvent(teamResponse.data.event);
      setLogs(logResponse.data);
      if (teamResponse.data.event?.server_now) setOffset(new Date(teamResponse.data.event.server_now).getTime() - Date.now());
      setUpdatedAt(new Date());
      setError('');
    } catch (err) { handleFailure(err); }
    finally { refreshing.current = false; }
  }, [filters, handleFailure]);

  useEffect(() => {
    if (!authenticated) return;
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [authenticated, refresh]);

  useEffect(() => {
    if (!authenticated) return;
    api.get('/quiz/config').then(res => { if (mounted.current) setConfig(res.data.config); }).catch(handleFailure);
  }, [authenticated, handleFailure]);

  useEffect(() => {
    if (event?.config && !configDirty) setConfig(event.config);
  }, [event?.config, configDirty]);

  useEffect(() => {
    const timeout = setTimeout(() => setFilters(current => current.search === logSearch ? current : { ...current, search: logSearch, page: 1 }), 300);
    return () => clearTimeout(timeout);
  }, [logSearch]);

  useEffect(() => {
    if (confirmEnd && authenticated && !endDialog.current?.open) endDialog.current?.showModal();
  }, [confirmEnd, authenticated]);

  const viewTeamLogs = team => {
    setLogSearch('');
    setFilters({ team_id: team._id, action: '', level: '', search: '', page: 1 });
    ledger.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
    ledger.current?.focus({ preventScroll: true });
  };

  const login = async e => {
    e.preventDefault(); setBusy('login'); setError('');
    try {
      const response = await api.post('/admin/login', { username, password });
      sessionStorage.setItem('adminToken', response.data.token);
      setAuthenticated(true); setPassword('');
    } catch (err) { handleFailure(err); }
    finally { setBusy(''); }
  };
  const action = async name => {
    setBusy(name); setNotice(''); setError('');
    try {
      await api.post(`/quiz/${name}`);
      setConfirmReset(false); setConfirmEnd(false); setConfigDirty(false);
      await refresh();
      setNotice(name === 'reset' ? 'Progress reset. Activity history has been preserved.' : name === 'start' ? 'The event has started for every team.' : 'The event has ended.');
    } catch (err) { handleFailure(err); }
    finally { setBusy(''); }
  };
  const saveConfig = async e => {
    e.preventDefault(); setBusy('config'); setNotice('');
    try {
      const response = await api.patch('/quiz/config', config);
      setConfig(response.data.config); setConfigDirty(false);
      setNotice('Round rules saved. They will be frozen when the event starts.');
      await refresh();
    } catch (err) { handleFailure(err); }
    finally { setBusy(''); }
  };
  const download = async (url, filename, params = {}) => {
    setBusy('download');
    try {
      const response = await api.get(url, { params, responseType: 'blob' });
      const address = URL.createObjectURL(response.data);
      const link = document.createElement('a'); link.href = address; link.download = filename;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(address), 1000);
    } catch (err) {
      if (err.response?.data instanceof Blob) {
        try { err.response.data = JSON.parse(await err.response.data.text()); } catch { /* Preserve the network error. */ }
      }
      handleFailure(err);
    } finally { setBusy(''); }
  };
  const changeFilter = (key, value) => setFilters(current => ({ ...current, [key]: value, page: 1 }));
  const configField = (key, value) => { setConfigDirty(true); setConfig(current => ({ ...current, [key]: number(value) })); };
  const roundField = (key, index, value) => {
    setConfigDirty(true);
    setConfig(current => ({ ...current, [key]: current[key].map((old, at) => at === index ? number(value) : old) }));
  };
  const serverNow = now + offset;
  const status = event?.status || 'not_started';
  const locked = status !== 'not_started';
  const eventRemaining = event?.deadline ? new Date(event.deadline).getTime() - serverNow : number(config.duration_minutes) * 60000;
  const selectedTeam = teams.find(team => team._id === filters.team_id);
  const filteredTeams = teams.filter(team => `${team.team_name} ${team.leader_name} ${team.question_set_id}`.toLowerCase().includes(search.toLowerCase()));

  if (!authenticated) return (
    <main className="event-admin admin-signin">
      <section className="admin-login-paper">
        <a href="/" className="admin-back"><ArrowLeft size={17} /> Team sign in</a>
        <LockKeyhole size={34} />
        <h1>Organizer access</h1><p>Manage the escape room and follow every team.</p>
        {error && <p role="alert" className="admin-error">{error}</p>}
        {checking ? <p>Restoring your session…</p> : <form onSubmit={login}>
          <label htmlFor="admin-username">Username</label>
          <input id="admin-username" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} required />
          <label htmlFor="admin-password">Password</label>
          <input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
          <button id="admin-login-btn" className="admin-button lime" disabled={Boolean(busy)}>{busy ? 'Signing in…' : 'Open control room'}</button>
        </form>}
      </section>
    </main>
  );

  return (
    <main className="event-admin" id="admin-page">
      <header className="admin-topbar"><a href="/" className="admin-brand">aarambh <span>4.0</span></a><div><a href="/admin/puzzles" className="admin-button small">Puzzle rehearsal</a><a href="/admin/answer-booklet" className="admin-button small">Answer booklet</a><span className="admin-update">{updatedAt ? `Updated ${dateTime(updatedAt)} IST` : 'Connecting…'}</span><button className="admin-button small" disabled={!!busy} onClick={signOut}>Sign out</button></div></header>
      <div className="admin-shell">
        <div className="admin-heading"><div><h1>Code escape.<br />Control room.</h1><p>Five rounds. One shared deadline. Every move recorded.</p></div><div className={`admin-event-clock ${status === 'active' ? 'live' : ''}`}><span>{status === 'active' ? 'Event time remaining' : status === 'ended' ? 'Event ended' : 'Event duration'}</span><strong>{status === 'ended' ? '00:00' : clock(eventRemaining)}</strong><span>{readable(status)}</span></div></div>
        {error && <div className="admin-error" role="alert">{error}<button className="admin-button small" onClick={refresh}>Refresh</button></div>}
        {notice && <p className="admin-notice" role="status">{notice}</p>}
        {status === 'ended' && <section className="admin-ended" role="status"><Square size={26} aria-hidden="true" /><div><h2>Code Escape has ended</h2><p>Answer submissions are closed for every team. Final scores and team activity are ready to review below.</p>{event?.ended_at && <small>Ended {dateTime(event.ended_at)} IST</small>}</div><button className="admin-button" disabled={Boolean(busy)} onClick={() => download('/export/excel', 'aarambh-results.xlsx')}><Download size={16} /> Download results</button></section>}
        <section className="admin-controls" aria-label="Event controls"><div><strong>{teams.length} teams</strong><span>{teams.filter(team => team.current_level >= 6).length} finished</span><span>{teams.filter(team => team.round?.overtime_ms > 0 && team.current_level < 6).length} in overtime</span></div><div>
          <button className="admin-button" onClick={() => setShowConfig(!showConfig)}><Settings2 size={16} /> {showConfig ? 'Hide rules' : 'Round rules'}</button>
          <button className="admin-button" onClick={refresh} disabled={Boolean(busy)} aria-label="Refresh dashboard"><RefreshCw size={16} /> Refresh</button>
          {['not_started', 'starting'].includes(status) && <button id="btn-start-quiz" className="admin-button lime" disabled={Boolean(busy) || !event || configDirty} onClick={() => action('start')}><Play size={16} /> {busy === 'start' ? 'Starting…' : status === 'starting' ? 'Resume event setup' : 'Start event'}</button>}
          {status === 'active' && <button id="btn-end-quiz" className="admin-button purple" disabled={Boolean(busy)} onClick={() => { setError(''); setConfirmEnd(true); }}><Square size={16} /> End event</button>}
          {['ended', 'resetting'].includes(status) && <button id="btn-reset-quiz" className="admin-button" disabled={Boolean(busy)} onClick={() => setConfirmReset(true)}>{status === 'resetting' ? 'Resume reset' : 'Reset progress'}</button>}
        </div></section>
        {confirmReset && <div className="admin-reset" role="alert"><p>Reset every team’s score, progress and round timers? Activity history stays available.</p><button className="admin-button purple" disabled={Boolean(busy)} onClick={() => action('reset')}>Reset all teams</button><button className="admin-button" onClick={() => setConfirmReset(false)}>Cancel</button></div>}
        {showConfig && <section className="admin-panel"><div className="admin-section-title"><h2>Round rules</h2><span>{locked ? 'Frozen for this event' : 'Editable before start'}</span></div><p>Unused time carries to the next round. Overtime reduces the round reward. Skipping deducts points and can make the total negative.</p><form onSubmit={saveConfig}><fieldset disabled={locked || Boolean(busy)}>
          <label className="admin-duration">Event duration <input type="number" readOnly value={120} /> minutes (fixed)</label>
          <div className="admin-round-rules">{config.round_minutes.map((minutes, index) => <div key={index}><strong>Round {index + 1}</strong><label>Time cap (minutes)<input type="number" min="1" max="120" required value={minutes} onChange={e => roundField('round_minutes', index, e.target.value)} /></label><label>Full reward (points)<input type="number" min="1" max="10000" required value={config.round_points[index]} onChange={e => roundField('round_points', index, e.target.value)} /></label></div>)}</div>
          <div className="admin-penalty-rules"><label>Reward decrease per overtime minute (%)<input type="number" min="0" max="100" step="0.1" required value={config.overtime_decay_percent_per_minute} onChange={e => configField('overtime_decay_percent_per_minute', e.target.value)} /></label><label>Minimum round reward (%)<input type="number" min="0" max="100" step="0.1" required value={config.minimum_reward_percent} onChange={e => configField('minimum_reward_percent', e.target.value)} /></label><label>Skip penalty (% of full reward)<input type="number" min="0" max="100" step="0.1" required value={config.skip_penalty_percent} onChange={e => configField('skip_penalty_percent', e.target.value)} /></label></div>
          <p>{config.round_minutes.reduce((sum, minutes) => sum + number(minutes), 0)} minutes across round caps. {Math.max(0, config.duration_minutes - config.round_minutes.reduce((sum, minutes) => sum + number(minutes), 0))} minutes left for overtime.</p>
          {!locked && <button className="admin-button lime" disabled={!configDirty || Boolean(busy)}>{busy === 'config' ? 'Saving…' : 'Save round rules'}</button>}
        </fieldset></form></section>}
        <section className="admin-panel"><div className="admin-section-title"><div><h2>Live teams</h2><p>Refreshes every 5 seconds. Ties use solved rounds, then the earliest time a score was reached.</p></div><button className="admin-button" disabled={Boolean(busy)} onClick={() => download('/export/excel', 'aarambh-results.xlsx')}><Download size={16} /> Results</button></div><label className="admin-search">Find a team<input placeholder="Team, leader or question set" value={search} onChange={e => setSearch(e.target.value)} /></label>
          <div className="admin-table-scroll"><table className="admin-team-table"><thead><tr><th>Rank / team</th><th>Set</th><th>Score</th><th>Round progress</th><th>Round clock</th><th>Reward / penalty</th><th>Last activity</th></tr></thead><tbody>{filteredTeams.map(team => {
            const round = team.round || {};
            const deadline = round.deadline ? new Date(round.deadline).getTime() : null;
            const roundRemaining = deadline ? deadline - (status === 'active' ? serverNow : event?.ended_at ? new Date(event.ended_at).getTime() : serverNow) : number(round.remaining_ms);
            const done = team.current_level >= 6;
            const overtime = !done && deadline && roundRemaining <= 0;
            return <tr key={team._id}><td><div className="admin-team-name"><span>{team.rank == null ? 'Revoked' : `#${team.rank}`}</span><strong>{team.team_name}</strong></div><small>{team.leader_name}</small><span className="admin-session">{team.access_enabled === false ? 'Access revoked' : team.session_active ? 'Signed in' : 'No active session'}</span><button className="admin-team-log-link" onClick={() => viewTeamLogs(team)}>View team logs</button></td><td>{team.question_set_id || 'Pending'}</td><td className="admin-score">{team.total_points}</td><td><div className="admin-outcomes">{[1, 2, 3, 4, 5].map(level => { const outcome = (team.outcomes || []).find(item => item.level === level); const state = outcome?.status || (team.current_level === level ? 'current' : 'pending'); return <span key={level} className={`admin-outcome ${state}`} title={`Round ${level}: ${state}${outcome ? ` (${outcome.points} points)` : ''}`} aria-label={`Round ${level}: ${state}`}>{state === 'solved' ? '✓' : state === 'skipped' ? '↷' : level}</span>; })}</div><small>{done ? 'Finished all rounds' : `Round ${Math.max(1, team.current_level)} of 5`}</small></td><td><strong className={overtime ? 'admin-overtime' : 'admin-round-clock'}>{done ? 'Finished' : !deadline ? 'Waiting' : `${overtime ? '+' : ''}${clock(Math.abs(roundRemaining))}`}</strong><small>{done ? dateTime(team.end_time) : overtime ? round.requires_decision ? 'Awaiting continue / skip' : 'Overtime' : `${clock(round.carry_ms)} carried forward`}</small></td><td>{done ? '—' : <><strong>{round.available_points ?? '—'} pts</strong><small>Skip: −{round.skip_penalty ?? '—'} pts</small></>}</td><td><small>{dateTime(team.last_activity?.timestamp)}</small><span className="admin-last-action">{readable(team.last_activity?.action) || 'No activity yet'}</span></td></tr>;
          })}</tbody></table></div>
          {filteredTeams.length === 0 && <p className="admin-empty">{teams.length ? 'No matching teams. Try another search.' : 'No teams registered yet. Add the event roster before starting.'}</p>}
          <div className="admin-table-legend"><span><i className="solved" />Solved</span><span><i className="skipped" />Skipped</span><span><i className="current" />Current round</span></div>
        </section>
        <section className="admin-panel" ref={ledger} tabIndex={-1} aria-label="Team activity logs"><div className="admin-section-title"><div><h2><Activity size={24} /> {selectedTeam ? `${selectedTeam.team_name}: activity` : 'Activity ledger'}</h2><p>{logs.total} entries. History is preserved across event resets. Times shown in IST.</p></div><button className="admin-button" disabled={Boolean(busy)} onClick={() => download('/admin/logs/export', 'aarambh-activity.csv', filters)}><Download size={16} /> Export filtered CSV</button></div>
          <label className="admin-search">Search activity<input type="search" maxLength={100} placeholder="Team, leader or action (e.g. round solved)" value={logSearch} onChange={e => setLogSearch(e.target.value)} /></label>
          <div className="admin-log-filters"><label>Team<select value={filters.team_id} onChange={e => changeFilter('team_id', e.target.value)}><option value="">All teams and organizers</option>{teams.map(team => <option key={team._id} value={team._id}>{team.team_name}</option>)}</select></label><label>Action<select value={filters.action} onChange={e => changeFilter('action', e.target.value)}><option value="">All actions</option>{logs.actions.map(action => <option key={action} value={action}>{readable(action)}</option>)}</select></label><label>Round<select value={filters.level} onChange={e => changeFilter('level', e.target.value)}><option value="">All rounds</option>{[1, 2, 3, 4, 5].map(level => <option key={level} value={level}>Round {level}</option>)}</select></label><button className="admin-button" onClick={() => { setLogSearch(''); setFilters({ team_id: '', action: '', level: '', search: '', page: 1 }); }}><X size={15} /> Clear filters</button></div>
          <div className="admin-table-scroll"><table className="admin-log-table"><thead><tr><th>Time (IST)</th><th>Team</th><th>Action</th><th>Round</th><th>Score change</th></tr></thead><tbody>{logs.logs.map(log => <tr key={log._id}><td>{dateTime(log.timestamp)}</td><td>{log.team_name}</td><td>{readable(log.action)}</td><td>{log.level || '—'}</td><td className={log.delta < 0 ? 'admin-overtime' : ''}>{log.delta == null ? '—' : `${log.delta > 0 ? '+' : ''}${log.delta}`}{typeof log.before === 'number' && typeof log.after === 'number' && <small>{log.before} → {log.after}</small>}</td></tr>)}</tbody></table></div>
          {!logs.logs.length && <p className="admin-empty">No activity matches these filters. Team sign-ins and event actions will appear here.</p>}
          <div className="admin-pagination"><button className="admin-button small" disabled={logs.page <= 1} onClick={() => setFilters(current => ({ ...current, page: Math.max(1, current.page - 1) }))}>Previous</button><span>Page {logs.page} of {logs.pages}</span><button className="admin-button small" disabled={logs.page >= logs.pages} onClick={() => setFilters(current => ({ ...current, page: current.page + 1 }))}>Next</button></div>
        </section>
      </div>
      {confirmEnd && <dialog ref={endDialog} className="admin-end-dialog" aria-labelledby="end-event-title" aria-describedby="end-event-description" onCancel={e => { if (busy) e.preventDefault(); else setConfirmEnd(false); }} onClose={() => setConfirmEnd(false)}>
        <Square size={30} aria-hidden="true" /><h2 id="end-event-title">End Code Escape for everyone?</h2>
        <p id="end-event-description">All team timers will stop and answer submissions will close. Scores and activity logs will be saved for review. This event cannot be resumed.</p>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <div className="admin-dialog-actions"><button autoFocus className="admin-button" disabled={Boolean(busy)} onClick={() => setConfirmEnd(false)}>Keep event running</button><button className="admin-button purple" disabled={Boolean(busy)} onClick={() => action('end')}>{busy === 'end' ? 'Ending event…' : 'End event for all teams'}</button></div>
      </dialog>}
    </main>
  );
}
