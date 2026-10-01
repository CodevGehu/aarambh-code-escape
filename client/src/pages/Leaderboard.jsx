import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import GlassCard from '../components/GlassCard';
import api from '../lib/api';
import { Trophy, Clock, ArrowLeft, Crown, Medal, Award, Search } from 'lucide-react';

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();



  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 5000);
    return () => clearInterval(interval);
  }, []);




  const fetchLeaderboard = async () => {
    try {
      const res = await api.get('/leaderboard');
      setLeaderboard(res.data.leaderboard);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (ms) => {
    if (!ms) return '—';
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
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

  const filtered = leaderboard.filter(entry =>
    (entry.team_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="page" id="leaderboard-page">
      <div className="app-background" />
      <div className="app-overlay" />
      <Navbar />

      <div className="page-content" style={{ padding: 'var(--space-2xl) 0 var(--space-3xl)' }}>
        <div className="container" style={{ maxWidth: '960px' }}>
          {/* Header */}
          <div className="animate-fade-in-up" style={{ marginBottom: 'var(--space-xl)' }}>
            <button
              className="btn btn-ghost"
              onClick={() => navigate('/dashboard')}
              style={{ padding: '6px 12px', fontSize: '0.8rem', marginBottom: 'var(--space-lg)' }}
              id="btn-back-leaderboard"
            >
              <ArrowLeft size={16} /> Back to Map
            </button>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Trophy size={36} />
              Leaderboard
            </h1>
            <p style={{ marginTop: '8px', fontSize: '0.9rem', color: 'rgba(245,230,200,0.5)' }}>
              Live rankings — updates automatically
            </p>
          </div>

          {/* Leaderboard Wrapper — Dark Glass Container */}
          <div className="animate-fade-in-up delay-100" style={{
            background: 'rgba(5, 12, 24, 0.55)',
            backdropFilter: 'blur(24px) saturate(160%)',
            WebkitBackdropFilter: 'blur(24px) saturate(160%)',
            border: '1px solid rgba(212, 168, 67, 0.2)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: '0 12px 48px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(212, 168, 67, 0.08)',
            padding: 'var(--space-xl) var(--space-xl) var(--space-2xl)',
            minHeight: '400px'
          }}>
            {/* Search Bar */}
            <div style={{ marginBottom: 'var(--space-xl)', position: 'relative' }}>
              <Search size={18} style={{
                position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
                color: 'rgba(245,230,200,0.35)', pointerEvents: 'none'
              }} />
              <input
                type="text"
                className="input"
                placeholder="Search teams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                id="leaderboard-search"
                style={{
                  paddingLeft: '44px',
                  background: 'rgba(10, 22, 40, 0.5)',
                  borderColor: 'rgba(212,168,67,0.15)'
                }}
              />
            </div>

            {/* Content */}
            {loading ? (
              <div className="flex-center" style={{ minHeight: '30vh' }}>
                <div className="animate-spin" style={{
                  width: '48px', height: '48px',
                  border: '3px solid rgba(212,168,67,0.2)',
                  borderTopColor: 'var(--color-gold)',
                  borderRadius: '50%'
                }} />
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-3xl) var(--space-lg)' }}>
                <Trophy size={48} color="rgba(245,230,200,0.2)" style={{ marginBottom: 'var(--space-md)' }} />
                <h3 style={{ marginBottom: 'var(--space-sm)', fontSize: '1.1rem' }}>
                  {searchQuery ? 'No teams found' : 'No Results Yet'}
                </h3>
                <p style={{ fontSize: '0.85rem' }}>
                  {searchQuery ? 'Try a different search term' : 'The hunt hasn\'t started yet!'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {filtered.map((entry) => (
                  <div
                    key={entry.team_name || entry.rank}
                    style={{
                      padding: 'var(--space-md) var(--space-lg)',
                      display: 'grid',
                      gridTemplateColumns: '44px 1fr auto auto',
                      alignItems: 'center',
                      gap: 'var(--space-lg)',
                      background: entry.rank <= 3 ? getRankStyle(entry.rank).background : 'rgba(245, 230, 200, 0.02)',
                      border: `1px solid ${entry.rank <= 3 ? getRankStyle(entry.rank).borderColor : 'rgba(245, 230, 200, 0.06)'}`,
                      borderRadius: 'var(--radius-md)',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(212, 168, 67, 0.06)';
                      e.currentTarget.style.borderColor = 'rgba(212, 168, 67, 0.25)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = entry.rank <= 3 ? getRankStyle(entry.rank).background : 'rgba(245, 230, 200, 0.02)';
                      e.currentTarget.style.borderColor = entry.rank <= 3 ? getRankStyle(entry.rank).borderColor : 'rgba(245, 230, 200, 0.06)';
                    }}
                    id={`leaderboard-row-${entry.rank}`}
                  >
                    <div className="flex-center">{getRankIcon(entry.rank)}</div>

                    <div>
                      <p style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--color-parchment)', marginBottom: '1px' }}>
                        {entry.team_name}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: 'rgba(245,230,200,0.4)' }}>
                        {entry.completed ? '✅ Completed' : `Level ${entry.current_level}`}
                      </p>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '5px',
                        color: 'var(--color-gold)', fontWeight: '700', fontSize: '1.05rem'
                      }}>
                        <Award size={15} />
                        {entry.total_points}
                      </div>
                      <p style={{ fontSize: '0.7rem', color: 'rgba(245,230,200,0.35)' }}>points</p>
                    </div>

                    <div style={{ textAlign: 'right', minWidth: '100px' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '5px',
                        color: 'rgba(245,230,200,0.6)', fontSize: '0.85rem', justifyContent: 'flex-end'
                      }}>
                        <Clock size={13} />
                        {formatTime(entry.time_taken)}
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
