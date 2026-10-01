import { useState, useEffect } from 'react';
import GlassCard from '../components/GlassCard';
import api from '../lib/api';
import {
  Trophy, Clock, Crown, Medal, Award, Download, Lock,
  LayoutGrid, LayoutList, RefreshCw, Users, Eye, EyeOff,
  Search, Play, Square, RotateCcw, AlertTriangle
} from 'lucide-react';

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  // Quiz state
  const [quizStatus, setQuizStatus] = useState('not_started');
  const [quizStartedAt, setQuizStartedAt] = useState(null);
  const [quizEndedAt, setQuizEndedAt] = useState(null);
  const [quizAction, setQuizAction] = useState(null); // loading state for buttons
  const [showResetConfirm, setShowResetConfirm] = useState(false);


  // Auto-restore admin session from sessionStorage on page load.
  // If a valid token exists, verify it with the server and skip the login form.
  useEffect(() => {
    const savedToken = sessionStorage.getItem('adminToken');
    if (savedToken) {
      api.get('/admin/verify')
        .then(() => setAuthenticated(true))
        .catch(() => sessionStorage.removeItem('adminToken'));
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    fetchLeaderboard();
    fetchQuizStatus();
    const interval = setInterval(() => {
      fetchLeaderboard();
      fetchQuizStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [authenticated]);

  const fetchLeaderboard = async () => {
    try {
      const res = await api.get('/leaderboard');
      setLeaderboard(res.data.leaderboard);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuizStatus = async () => {
    try {
      const res = await api.get('/quiz/status');
      setQuizStatus(res.data.status);
      setQuizStartedAt(res.data.started_at);
      setQuizEndedAt(res.data.ended_at);
    } catch (err) {
      console.error('Error fetching quiz status:', err);
    }
  };

  const handleQuizAction = async (action) => {
    setQuizAction(action);
    try {
      await api.post(`/quiz/${action}`);
      await fetchQuizStatus();
      await fetchLeaderboard();
    } catch (err) {
      console.error(`Error ${action}ing quiz:`, err);
      alert(err.response?.data?.error || `Failed to ${action} quiz`);
    } finally {
      setQuizAction(null);
      setShowResetConfirm(false);
    }
  };

  // FIX: Always clear sessionStorage on logout so the admin JWT does not persist
  // and accidentally get attached to participant API calls via the api.js interceptor.
  const handleLogout = () => {
    sessionStorage.removeItem('adminToken');
    setAuthenticated(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/admin/login', { username, password });
      sessionStorage.setItem('adminToken', res.data.token);
      setAuthenticated(true);
      setLoginError('');
      setUsername('');
      setPassword('');
    } catch (err) {
      setLoginError(err.response?.data?.error || 'Invalid credentials');
    }
  };

  const handleExport = async () => {
    try {
      const res = await api.get('/export/excel', {
        responseType: 'blob' // Important: ensures we receive raw binary data for the excel
      });
      
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'treasure-hunt-results.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      console.error(err);
      alert('Failed to export: ' + (err.message || 'Unknown error'));
    }
  };

  const formatTime = (ms) => {
    if (!ms) return '—';
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleTimeString();
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return <Crown size={20} color="#FFD700" />;
    if (rank === 2) return <Medal size={20} color="#C0C0C0" />;
    if (rank === 3) return <Medal size={20} color="#CD7F32" />;
    return <span style={{ fontWeight: '700', color: 'rgba(245,230,200,0.5)' }}>#{rank}</span>;
  };

  const getRankStyle = (rank) => {
    if (rank === 1) return { borderColor: 'rgba(255, 215, 0, 0.5)', background: 'rgba(255, 215, 0, 0.06)' };
    if (rank === 2) return { borderColor: 'rgba(192, 192, 192, 0.4)', background: 'rgba(192, 192, 192, 0.04)' };
    if (rank === 3) return { borderColor: 'rgba(205, 127, 50, 0.4)', background: 'rgba(205, 127, 50, 0.04)' };
    return {};
  };

  const getStatusColor = () => {
    if (quizStatus === 'active') return 'var(--color-green-light)';
    if (quizStatus === 'ended') return 'var(--color-red-light)';
    return 'rgba(245,230,200,0.5)';
  };

  const getStatusLabel = () => {
    if (quizStatus === 'active') return '● Live';
    if (quizStatus === 'ended') return '● Ended';
    return '○ Not Started';
  };

  const filtered = leaderboard.filter(entry =>
    (entry.team_name && entry.team_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (entry.leader_name && entry.leader_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // ============ LOGIN SCREEN ============
  if (!authenticated) {
    return (
      <div className="page" id="admin-login">
        <div className="app-background" />
        <div className="app-overlay" />
        <div className="flex-center" style={{ minHeight: '100vh', padding: 'var(--space-lg)' }}>
          <GlassCard className="animate-scale-in"
            style={{ maxWidth: '420px', width: '100%', textAlign: 'center', padding: 'var(--space-3xl) var(--space-2xl)' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--color-red-dark), var(--color-red))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto var(--space-lg)', boxShadow: '0 6px 24px rgba(198, 40, 40, 0.4)'
            }}><Lock size={28} color="white" /></div>
            <h2 style={{ marginBottom: 'var(--space-xs)', fontSize: '1.6rem' }}>Admin Panel</h2>
            <p style={{ marginBottom: 'var(--space-xl)', fontSize: '0.85rem', color: 'rgba(245,230,200,0.5)' }}>Authorized access only</p>
            {loginError && (
              <div style={{
                background: 'rgba(198, 40, 40, 0.15)', border: '1px solid rgba(198, 40, 40, 0.4)',
                borderRadius: 'var(--radius-md)', padding: 'var(--space-sm) var(--space-md)',
                marginBottom: 'var(--space-md)', color: '#ef9a9a', fontSize: '0.85rem'
              }}>{loginError}</div>
            )}
            <form onSubmit={handleLogin}>
              <input type="text" className="input" placeholder="Username" value={username}
                onChange={(e) => setUsername(e.target.value)} style={{ marginBottom: 'var(--space-md)' }}
                id="admin-username" autoComplete="off" />
              <div style={{ position: 'relative', marginBottom: 'var(--space-lg)' }}>
                <input type={showPassword ? 'text' : 'password'} className="input" placeholder="Password"
                  value={password} onChange={(e) => setPassword(e.target.value)} id="admin-password" autoComplete="off" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'rgba(245,230,200,0.4)', cursor: 'pointer', padding: '4px'
                }}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} id="admin-login-btn">Access Panel</button>
            </form>
          </GlassCard>
        </div>
      </div>
    );
  }

  // ============ ADMIN DASHBOARD ============
  return (
    <div className="page" id="admin-page">
      <div className="app-background" />
      <div className="app-overlay" />

      <nav className="navbar">
        <div className="navbar-inner">
          <div className="navbar-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={20} /> Admin Panel
          </div>
          <div className="navbar-actions">
            {lastUpdated && (
              <span style={{ fontSize: '0.75rem', color: 'rgba(245,230,200,0.4)', marginRight: '8px' }}>
                <RefreshCw size={12} style={{ display: 'inline', marginRight: '4px' }} />
                {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button className="btn btn-ghost" onClick={handleLogout}
              style={{ padding: '8px 16px', fontSize: '0.8rem' }}>Logout</button>
          </div>
        </div>
      </nav>

      <div className="page-content" style={{ padding: 'var(--space-2xl) 0 var(--space-3xl)' }}>
        <div className="container" style={{ maxWidth: '1100px' }}>

          {/* ====== QUIZ CONTROL PANEL ====== */}
          <div className="animate-fade-in-up" style={{
            background: 'rgba(5, 12, 24, 0.6)',
            backdropFilter: 'blur(20px) saturate(150%)',
            WebkitBackdropFilter: 'blur(20px) saturate(150%)',
            border: '1px solid rgba(212, 168, 67, 0.2)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            padding: 'var(--space-xl)',
            marginBottom: 'var(--space-xl)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 'var(--space-md)'
          }}>
            {/* Status */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Quiz Control</h3>
                <span style={{
                  fontSize: '0.8rem', fontWeight: '700', color: getStatusColor(),
                  background: `${getStatusColor()}15`, padding: '3px 10px',
                  borderRadius: 'var(--radius-full)', border: `1px solid ${getStatusColor()}30`
                }}>{getStatusLabel()}</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'rgba(245,230,200,0.4)', margin: 0 }}>
                {quizStatus === 'active' && `Started at ${formatDateTime(quizStartedAt)}`}
                {quizStatus === 'ended' && `Ended at ${formatDateTime(quizEndedAt)}`}
                {quizStatus === 'not_started' && 'Ready to begin'}
              </p>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
              {quizStatus === 'not_started' && (
                <button className="btn" onClick={() => handleQuizAction('start')}
                  disabled={!!quizAction} id="btn-start-quiz"
                  style={{
                    padding: '10px 24px', fontSize: '0.85rem', fontWeight: '700',
                    background: 'linear-gradient(135deg, #2e7d32, #43a047)',
                    color: 'white', border: 'none', borderRadius: 'var(--radius-md)',
                    display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                    opacity: quizAction ? 0.6 : 1, boxShadow: '0 4px 16px rgba(46,125,50,0.4)'
                  }}>
                  <Play size={18} /> {quizAction === 'start' ? 'Starting...' : 'START QUIZ'}
                </button>
              )}

              {quizStatus === 'active' && (
                <button className="btn" onClick={() => handleQuizAction('end')}
                  disabled={!!quizAction} id="btn-end-quiz"
                  style={{
                    padding: '10px 24px', fontSize: '0.85rem', fontWeight: '700',
                    background: 'linear-gradient(135deg, #c62828, #e53935)',
                    color: 'white', border: 'none', borderRadius: 'var(--radius-md)',
                    display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                    opacity: quizAction ? 0.6 : 1, boxShadow: '0 4px 16px rgba(198,40,40,0.4)'
                  }}>
                  <Square size={18} /> {quizAction === 'end' ? 'Ending...' : 'END QUIZ'}
                </button>
              )}

              {quizStatus === 'ended' && (
                <>
                  {!showResetConfirm ? (
                    <button className="btn" onClick={() => setShowResetConfirm(true)}
                      id="btn-reset-quiz"
                      style={{
                        padding: '10px 24px', fontSize: '0.85rem', fontWeight: '700',
                        background: 'rgba(245, 230, 200, 0.08)', color: 'var(--color-parchment)',
                        border: '1px solid rgba(245,230,200,0.15)', borderRadius: 'var(--radius-md)',
                        display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'
                      }}>
                      <RotateCcw size={16} /> RESET QUIZ
                    </button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle size={18} color="var(--color-gold)" />
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-gold)' }}>Reset all progress?</span>
                      <button className="btn" onClick={() => handleQuizAction('reset')}
                        disabled={!!quizAction}
                        style={{
                          padding: '6px 16px', fontSize: '0.8rem', fontWeight: '700',
                          background: 'linear-gradient(135deg, #c62828, #e53935)', color: 'white',
                          border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer'
                        }}>Yes, Reset</button>
                      <button className="btn btn-ghost" onClick={() => setShowResetConfirm(false)}
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Cancel</button>
                    </div>
                  )}


                </>
              )}
            </div>
          </div>

          {/* ====== HEADER + ACTIONS ====== */}
          <div className="animate-fade-in-up delay-100" style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            marginBottom: 'var(--space-xl)', flexWrap: 'wrap', gap: 'var(--space-md)'
          }}>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <Trophy size={36} /> Live Leaderboard
              </h1>
              <p style={{ fontSize: '0.9rem', color: 'rgba(245,230,200,0.5)' }}>
                {leaderboard.length} teams • Auto-refreshing every 5s
              </p>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
              <div style={{
                display: 'flex', background: 'rgba(10,22,40,0.5)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)', overflow: 'hidden'
              }}>
                <button onClick={() => setViewMode('list')} style={{
                  padding: '8px 14px', border: 'none', cursor: 'pointer',
                  background: viewMode === 'list' ? 'rgba(212,168,67,0.2)' : 'transparent',
                  color: viewMode === 'list' ? 'var(--color-gold)' : 'rgba(245,230,200,0.4)',
                  display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', transition: 'all 0.2s ease'
                }} id="btn-view-list"><LayoutList size={16} /> List</button>
                <button onClick={() => setViewMode('grid')} style={{
                  padding: '8px 14px', border: 'none', cursor: 'pointer',
                  background: viewMode === 'grid' ? 'rgba(212,168,67,0.2)' : 'transparent',
                  color: viewMode === 'grid' ? 'var(--color-gold)' : 'rgba(245,230,200,0.4)',
                  display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', transition: 'all 0.2s ease'
                }} id="btn-view-grid"><LayoutGrid size={16} /> Grid</button>
              </div>
              <button className="btn btn-primary" onClick={handleExport} id="btn-admin-export"
                style={{ padding: '8px 18px', fontSize: '0.85rem' }}>
                <Download size={16} /> Export Excel
              </button>
            </div>
          </div>

          {/* ====== STATS ====== */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 'var(--space-md)', marginBottom: 'var(--space-xl)'
          }} className="animate-fade-in-up delay-200">
            <GlassCard style={{ padding: 'var(--space-md)', textAlign: 'center' }}>
              <Users size={20} color="var(--color-gold)" style={{ marginBottom: '6px' }} />
              <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.5, marginBottom: '2px' }}>Total Teams</p>
              <p style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--color-gold)' }}>{leaderboard.length}</p>
            </GlassCard>
            <GlassCard style={{ padding: 'var(--space-md)', textAlign: 'center' }}>
              <Award size={20} color="var(--color-green-light)" style={{ marginBottom: '6px' }} />
              <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.5, marginBottom: '2px' }}>Completed</p>
              <p style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--color-green-light)' }}>
                {leaderboard.filter(e => e.completed).length}
              </p>
            </GlassCard>
            <GlassCard style={{ padding: 'var(--space-md)', textAlign: 'center' }}>
              <Trophy size={20} color="#FFD700" style={{ marginBottom: '6px' }} />
              <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.5, marginBottom: '2px' }}>Top Score</p>
              <p style={{ fontSize: '1.3rem', fontWeight: '800', color: '#FFD700' }}>
                {leaderboard.length > 0 ? leaderboard[0].total_points : 0}
              </p>
            </GlassCard>
            <GlassCard style={{ padding: 'var(--space-md)', textAlign: 'center' }}>
              <RefreshCw size={20} color={getStatusColor()} style={{ marginBottom: '6px' }} />
              <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.5, marginBottom: '2px' }}>Status</p>
              <p style={{ fontSize: '0.9rem', fontWeight: '700', color: getStatusColor() }}>{getStatusLabel()}</p>
            </GlassCard>
          </div>

          {/* ====== LEADERBOARD WRAPPER ====== */}
          <div className="animate-fade-in-up delay-300" style={{
            background: 'rgba(5, 12, 24, 0.55)',
            backdropFilter: 'blur(24px) saturate(160%)',
            WebkitBackdropFilter: 'blur(24px) saturate(160%)',
            border: '1px solid rgba(212, 168, 67, 0.2)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: '0 12px 48px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(212, 168, 67, 0.08)',
            padding: 'var(--space-xl) var(--space-xl) var(--space-2xl)',
            minHeight: '300px'
          }}>
            {/* Search */}
            <div style={{ marginBottom: 'var(--space-xl)', position: 'relative' }}>
              <Search size={18} style={{
                position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
                color: 'rgba(245,230,200,0.35)', pointerEvents: 'none'
              }} />
              <input type="text" className="input" placeholder="Search teams or leaders..."
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                id="admin-search" style={{ paddingLeft: '44px', background: 'rgba(10, 22, 40, 0.5)', borderColor: 'rgba(212,168,67,0.15)' }} />
            </div>

            {loading ? (
              <div className="flex-center" style={{ minHeight: '30vh' }}>
                <div className="animate-spin" style={{
                  width: '48px', height: '48px', border: '3px solid rgba(212,168,67,0.2)',
                  borderTopColor: 'var(--color-gold)', borderRadius: '50%'
                }} />
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-3xl) var(--space-lg)' }}>
                <Trophy size={48} color="rgba(245,230,200,0.2)" style={{ marginBottom: 'var(--space-md)' }} />
                <h3 style={{ marginBottom: 'var(--space-sm)', fontSize: '1.1rem' }}>
                  {searchQuery ? 'No teams found' : 'No Teams Yet'}
                </h3>
                <p style={{ fontSize: '0.85rem' }}>
                  {searchQuery ? 'Try a different search term' : 'Waiting for teams to start...'}
                </p>
              </div>
            ) : viewMode === 'list' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {filtered.map((entry) => (
                  <div key={entry.team_name || entry.rank} style={{
                    padding: 'var(--space-md) var(--space-lg)',
                    display: 'grid', gridTemplateColumns: '44px 1.5fr 0.7fr 0.7fr 0.8fr',
                    alignItems: 'center', gap: 'var(--space-md)',
                    background: entry.rank <= 3 ? getRankStyle(entry.rank).background : 'rgba(245, 230, 200, 0.02)',
                    border: `1px solid ${entry.rank <= 3 ? getRankStyle(entry.rank).borderColor : 'rgba(245, 230, 200, 0.06)'}`,
                    borderRadius: 'var(--radius-md)', transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(212, 168, 67, 0.06)'; e.currentTarget.style.borderColor = 'rgba(212, 168, 67, 0.25)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = entry.rank <= 3 ? getRankStyle(entry.rank).background : 'rgba(245, 230, 200, 0.02)'; e.currentTarget.style.borderColor = entry.rank <= 3 ? getRankStyle(entry.rank).borderColor : 'rgba(245, 230, 200, 0.06)'; }}
                  id={`admin-row-${entry.rank}`}>
                    <div className="flex-center">{getRankIcon(entry.rank)}</div>
                    <div>
                      <p style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--color-parchment)', marginBottom: '1px' }}>{entry.team_name}</p>
                      <p style={{ fontSize: '0.75rem', color: 'rgba(245,230,200,0.4)' }}>{entry.leader_name}</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.4, marginBottom: '1px' }}>Level</p>
                      <p style={{ fontWeight: '700', color: 'var(--color-parchment)', fontSize: '0.95rem' }}>
                        {entry.completed ? '✅ Done' : entry.current_level + '/5'}
                      </p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.4, marginBottom: '1px' }}>Points</p>
                      <p style={{ fontWeight: '700', color: 'var(--color-gold)', fontSize: '1.05rem' }}>{entry.total_points}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.4, marginBottom: '1px' }}>Time</p>
                      <p style={{ fontSize: '0.85rem', color: 'rgba(245,230,200,0.6)' }}>{formatTime(entry.time_taken)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-lg)' }}>
                {filtered.map((entry) => (
                  <div key={entry.team_name || entry.rank} style={{
                    padding: 'var(--space-xl)', position: 'relative', overflow: 'hidden',
                    background: entry.rank <= 3 ? getRankStyle(entry.rank).background : 'rgba(245, 230, 200, 0.02)',
                    border: `1px solid ${entry.rank <= 3 ? getRankStyle(entry.rank).borderColor : 'rgba(245, 230, 200, 0.06)'}`,
                    borderRadius: 'var(--radius-lg)', transition: 'all 0.25s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(212, 168, 67, 0.06)'; e.currentTarget.style.borderColor = 'rgba(212, 168, 67, 0.3)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = entry.rank <= 3 ? getRankStyle(entry.rank).background : 'rgba(245, 230, 200, 0.02)'; e.currentTarget.style.borderColor = entry.rank <= 3 ? getRankStyle(entry.rank).borderColor : 'rgba(245, 230, 200, 0.06)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                  id={`admin-grid-${entry.rank}`}>
                    <div style={{
                      position: 'absolute', top: '12px', right: '12px',
                      background: entry.rank <= 3 ? 'rgba(212,168,67,0.15)' : 'rgba(245,230,200,0.05)',
                      borderRadius: 'var(--radius-full)', width: '36px', height: '36px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>{getRankIcon(entry.rank)}</div>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '3px', paddingRight: '40px' }}>{entry.team_name}</h3>
                    <p style={{ fontSize: '0.78rem', color: 'rgba(245,230,200,0.4)', marginBottom: 'var(--space-lg)' }}>{entry.leader_name}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', borderTop: '1px solid rgba(212,168,67,0.1)', paddingTop: 'var(--space-md)' }}>
                      <div>
                        <p style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.4, marginBottom: '2px' }}>Points</p>
                        <p style={{ fontWeight: '800', color: 'var(--color-gold)', fontSize: '1.2rem' }}>{entry.total_points}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.4, marginBottom: '2px' }}>Level</p>
                        <p style={{ fontWeight: '700', color: 'var(--color-parchment)' }}>{entry.completed ? '✅ Done' : entry.current_level + '/5'}</p>
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <p style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.4, marginBottom: '2px' }}>Time</p>
                        <p style={{ fontSize: '0.82rem', color: 'rgba(245,230,200,0.55)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={13} /> {formatTime(entry.time_taken)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>


    </div>
  );
}
