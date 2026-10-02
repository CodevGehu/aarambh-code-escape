import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Code2, Trophy, LogOut, BookOpen } from 'lucide-react';
export default function Navbar({ onTutorialOpen }) {
  const { team, signOut } = useAuth();
  const navigate = useNavigate();
  return <nav className="navbar"><div className="navbar-inner">
    <button className="navbar-logo" onClick={() => navigate(team ? '/dashboard' : '/')}><span className="brand-box"><Code2 size={25} /></span><span>Aarambh 4.0<br /><small style={{ fontSize: '.72rem', fontWeight: 600 }}>Code escape room</small></span></button>
    <div className="navbar-actions"><span className="navbar-team">{team?.team_name}</span>
      {onTutorialOpen && <button className="btn btn-ghost" onClick={onTutorialOpen}><BookOpen size={16} /> Rules</button>}
      <button className="btn btn-ghost" onClick={() => navigate('/leaderboard')}><Trophy size={16} /> Rankings</button>
      {team && <button className="btn" onClick={signOut} aria-label="Sign out"><LogOut size={16} /></button>}
    </div>
  </div></nav>;
}
