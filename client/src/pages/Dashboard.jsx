import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import QuestMap from '../components/QuestMap';
import TutorialModal from '../components/TutorialModal';
import GlassCard from '../components/GlassCard';
import api from '../lib/api';
import { Users, Clock, Award, Zap } from 'lucide-react';

export default function Dashboard() {
  const { team, refreshTeam } = useAuth();
  const navigate = useNavigate();
  const [showTutorial, setShowTutorial] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('');
  const [quizStatus, setQuizStatus] = useState(null); 
  const [bannerMsg, setBannerMsg] = useState(null);
  const [showEndedModal, setShowEndedModal] = useState(false);
  const previousQuizStatus = useRef(null);
  const bannerTimeoutRef = useRef(null);
  
  const location = useLocation();
  const [animatedLevel, setAnimatedLevel] = useState(location.state?.justCompletedLevel || null);

  // Clear the router state immediately so refresh doesn't re-trigger the ship sailing animation
  useEffect(() => {
    if (location.state?.justCompletedLevel) {
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Show tutorial on first visit
  useEffect(() => {
    const dismissed = localStorage.getItem('tutorial_dismissed');
    if (!dismissed) {
      setShowTutorial(true);
    }
  }, []);

  // Live elapsed timer
  useEffect(() => {
    if (!team?.start_time) return;

    const updateTimer = () => {
      const start = new Date(team.start_time).getTime();
      const end = team.end_time ? new Date(team.end_time).getTime() : Date.now();
      const ms = end - start;
      const hours = Math.floor(ms / 3600000);
      const minutes = Math.floor((ms % 3600000) / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      setElapsedTime(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    updateTimer();
    const interval = team.end_time ? null : setInterval(updateTimer, 1000);
    return () => interval && clearInterval(interval);
  }, [team?.start_time, team?.end_time]);

  // Refresh team data and quiz status on mount + poll
  // refreshTeam is polled alongside quiz status so that non-selected teams
  // (whose DB record was deleted during a round transition) get auto-logged out.
  useEffect(() => {
    refreshTeam();
    fetchQuizStatus();
    const interval = setInterval(() => {
      fetchQuizStatus();
      refreshTeam();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchQuizStatus = async () => {
    try {
      const res = await api.get('/quiz/status');
      setQuizStatus(res.data.status);
    } catch (err) {
      console.error('Error fetching quiz status:', err);
    }
  };

  // Watch for quizStatus transitions to trigger banners and modals
  useEffect(() => {
    if (quizStatus !== null) {
      const prev = previousQuizStatus.current;
      
      // Trigger banner if transitioning to active
      if (prev !== null && prev !== 'active' && quizStatus === 'active') {
        if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
        setBannerMsg({ type: 'success', text: 'The Treasure Hunt has started! Good luck, pirate!' });
        bannerTimeoutRef.current = setTimeout(() => setBannerMsg(null), 5000);
      }
      
      // Trigger ended modal if transitioning to ended
      if (prev !== null && prev !== 'ended' && quizStatus === 'ended') {
        setShowEndedModal(true);
      }
      
      previousQuizStatus.current = quizStatus;
    }
  }, [quizStatus]);

  const handleLevelClick = (level) => {
    if (quizStatus !== 'active') {
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
      setBannerMsg({ type: 'error', text: 'The quiz is not currently active. Please wait for the admin to start!' });
      bannerTimeoutRef.current = setTimeout(() => setBannerMsg(null), 5000);
      return;
    }
    // Completed level — don't navigate; show a friendly in-app message
    const alreadyDone = team?.current_level > level || (gameFinished && level <= 5);
    if (alreadyDone) {
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
      setBannerMsg({ type: 'done', text: `⚓ Level ${level} already conquered! Don't be greedy, pirate — sail forward!` });
      bannerTimeoutRef.current = setTimeout(() => setBannerMsg(null), 4000);
      return;
    }
    navigate(`/question/${level}`);
  };

  const gameFinished = team?.current_level >= 6;
  const progress = gameFinished ? 100 : ((team?.current_level - 1) / 5) * 100;

  // Use exact points tracked server-side in team.level_points.
  // Falls back to level*100 estimate only for teams predating this feature.
  const getLevelPoints = (level) => {
    if (level < team?.current_level || gameFinished) {
      const tracked = team?.level_points?.[level];
      return tracked !== undefined ? tracked : level * 100;
    }
    return 0;
  };

  return (
    <div className="page dashboard-fullscreen" id="dashboard-page">
      <div className="app-background" />

      <Navbar onTutorialOpen={() => setShowTutorial(true)} />

      {/* Sticky Status Banner */}
      {bannerMsg && (
        <div className="status-banner animate-fade-in-up" style={{
          position: 'fixed', top: '76px', left: '0', right: '0', margin: '0 auto', padding: '14px 20px', maxWidth: '700px', width: '90%',
          background: bannerMsg.type === 'success'
            ? 'rgba(76, 175, 80, 0.22)'
            : bannerMsg.type === 'done'
            ? 'rgba(16, 24, 48, 0.96)' // Deep navy blue, highly opaque
            : 'rgba(244, 67, 54, 0.22)',
          border: `1px solid ${
            bannerMsg.type === 'success'
              ? 'rgba(76, 175, 80, 0.55)'
              : bannerMsg.type === 'done'
              ? 'rgba(255, 193, 7, 0.9)' // Glowing solid gold
              : 'rgba(244, 67, 54, 0.55)'
          }`,
          borderRadius: 'var(--radius-md)',
          color: bannerMsg.type === 'success' ? '#A5D6A7' : bannerMsg.type === 'done' ? '#FFFFFF' : '#EF9A9A',
          textAlign: 'center', fontWeight: '600', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', zIndex: 90,
          boxShadow: bannerMsg.type === 'done' 
            ? '0 12px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(255, 193, 7, 0.25)' 
            : '0 8px 32px rgba(0, 0, 0, 0.3)', 
          fontSize: '0.98rem', letterSpacing: '0.5px'
        }}>
          {bannerMsg.text}
        </div>
      )}

      <div className="dashboard-layout">
        {/* Sidebar for Stats */}
        <aside className="dashboard-sidebar animate-fade-in-right">
          <div className="sidebar-header" style={{ marginBottom: 'var(--space-xl)' }}>
            <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>
              {gameFinished ? '🎉 Quest Complete!' : '⚓ Your Quest'}
            </h2>
            <p style={{ fontSize: '0.95rem', opacity: 0.8 }}>
              {gameFinished ? 'Congratulations! You found all the treasures!' : 'Navigate the islands and claim your treasure'}
            </p>
          </div>

          <div className="sidebar-stats">
            <GlassCard style={{ padding: 'var(--space-md)', marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(212,168,67,0.1)', padding: '10px', borderRadius: '50%' }}><Users size={20} color="var(--color-gold)" /></div>
              <div>
                <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', opacity: 0.6 }}>Team</p>
                <p style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--color-parchment)' }}>{team?.team_name}</p>
              </div>
            </GlassCard>

            <GlassCard style={{ padding: 'var(--space-md)', marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(212,168,67,0.1)', padding: '10px', borderRadius: '50%' }}><Award size={20} color="var(--color-gold)" /></div>
              <div>
                <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', opacity: 0.6 }}>Points</p>
                <p style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--color-gold)' }}>{team?.total_points || 0}</p>
              </div>
            </GlassCard>

            <GlassCard style={{ padding: 'var(--space-md)', marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(212,168,67,0.1)', padding: '10px', borderRadius: '50%' }}><Zap size={20} color="var(--color-gold)" /></div>
              <div>
                <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', opacity: 0.6 }}>Level</p>
                <p style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--color-parchment)' }}>{gameFinished ? 'All Done!' : `${team?.current_level || 0} / 5`}</p>
              </div>
            </GlassCard>

            <GlassCard style={{ padding: 'var(--space-md)', marginBottom: 'var(--space-xl)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(212,168,67,0.1)', padding: '10px', borderRadius: '50%' }}><Clock size={20} color="var(--color-gold)" /></div>
              <div>
                <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', opacity: 0.6 }}>Time</p>
                <p style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--color-parchment)', fontVariantNumeric: 'tabular-nums' }}>{elapsedTime || '—'}</p>
              </div>
            </GlassCard>
          </div>

          {/* Progress Bar in sidebar */}
          <div className="sidebar-progress">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-gold)' }}>Quest Progress</span>
              <span style={{ fontSize: '0.8rem', color: 'rgba(245,230,200,0.6)' }}>{Math.round(progress)}%</span>
            </div>
            <div style={{ height: '6px', background: 'rgba(245, 230, 200, 0.1)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${progress}%`,
                background: 'linear-gradient(90deg, var(--color-gold-dark), var(--color-gold), var(--color-gold-light))',
                borderRadius: 'var(--radius-full)', transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 0 12px rgba(212, 168, 67, 0.4)'
              }} />
            </div>
          </div>
        </aside>

        {/* Main Map Area full screen */}
        <main className="dashboard-map-area animate-scale-in">
          <QuestMap 
            currentLevel={team?.current_level || 0}
            gameFinished={gameFinished}
            onLevelClick={handleLevelClick}
            levelPoints={team?.level_points || {}}
            justCompletedLevel={animatedLevel}
          />
        </main>
      </div>

      {/* Tutorial Modal */}
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}

      {/* Quiz Ended Modal */}
      {showEndedModal && (
        <div className="tutorial-overlay animate-fade-in" style={{ zIndex: 2000, position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="tutorial-card animate-scale-in" style={{ maxWidth: '400px', textAlign: 'center', padding: 'var(--space-2xl)', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-xl)' }}>
            <h2 style={{ color: '#E53935', fontSize: '1.8rem', marginBottom: 'var(--space-md)' }}>Time's Up!</h2>
            <p style={{ fontSize: '1.1rem', color: 'var(--color-parchment)', marginBottom: 'var(--space-xl)' }}>
              The Treasure Hunt has officially ended. Great job exploring! Check the leaderboard for final results.
            </p>
            <button className="btn btn-primary" onClick={() => setShowEndedModal(false)} style={{ width: '100%', padding: '12px' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
