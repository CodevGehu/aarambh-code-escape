import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Trophy, BookOpen, LogOut, Compass } from 'lucide-react';

export default function Navbar({ onTutorialOpen }) {
  const { team, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <nav className="navbar" id="main-navbar">
      <div className="navbar-inner">
        <div
          className="navbar-logo"
          onClick={() => navigate('/dashboard')}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Compass size={24} />
          Treasure Hunt
        </div>

        <div className="navbar-actions">
          {team && (
            <span className="navbar-team">
              ⚓ {team.team_name}
            </span>
          )}

          {onTutorialOpen && (
            <button
              className="btn btn-ghost"
              onClick={onTutorialOpen}
              style={{ padding: '8px 16px', fontSize: '0.8rem' }}
              id="btn-tutorial"
            >
              <BookOpen size={16} />
              Tutorial
            </button>
          )}

          <button
            className={`btn btn-ghost ${location.pathname === '/leaderboard' ? 'active' : ''}`}
            onClick={() => navigate('/leaderboard')}
            style={{ padding: '8px 16px', fontSize: '0.8rem' }}
            id="btn-leaderboard"
          >
            <Trophy size={16} />
            Ranks
          </button>

          <button
            className="btn btn-ghost"
            onClick={handleSignOut}
            style={{ padding: '8px 16px', fontSize: '0.8rem' }}
            id="btn-signout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </nav>
  );
}
