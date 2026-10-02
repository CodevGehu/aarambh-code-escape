import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import QuestMap from '../components/QuestMap';
import TutorialModal from '../components/TutorialModal';
import GameClocks from '../components/GameClocks';
import { useGameClock, formatClock } from '../lib/gameClock';
import { ArrowRight, Check, Trophy } from 'lucide-react';

export default function Dashboard() {
  const game = useGameClock();
  const { team, event, round, ended, error, availablePoints, decision } = game;
  const navigate = useNavigate();
  const location = useLocation();
  const [showRules, setShowRules] = useState(false);
  const finished = team?.current_level >= 6;
  const active = event?.status === 'active' && !ended && !finished;
  const outcomes = team?.outcomes || [];
  return <div className="page"><Navbar onTutorialOpen={() => setShowRules(true)} /><main className="container page-content">
    <div className="page-heading row between"><div><h1>{finished ? 'Path complete.' : ended ? 'The event has ended.' : 'Your escape route.'}</h1><p className="muted">{finished ? 'Every round is settled. Your final score is saved.' : ended ? 'The event has ended. Your recorded progress and score are final.' : 'Follow the clues. Clear the rooms. Keep your saved time.'}</p></div><span className={`badge ${active ? 'badge-lime' : 'badge-pink'}`}>{finished ? 'Finished' : ended ? 'Event ended' : event?.status === 'not_started' ? 'Waiting for start' : 'Live event'}</span></div>
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    <GameClocks game={game} />
    <div className="dashboard-grid"><section>
      {!event && <p className="notice" role="status">Synchronizing your team…</p>}
      {event?.status === 'not_started' && <div className="notice" style={{ marginBottom:22 }}><strong>You're in the lobby.</strong><p>Everyone starts when the organizer starts the event. Your timer will begin automatically.</p></div>}
      <QuestMap currentLevel={team?.current_level || 1} outcomes={outcomes} active={active} justCompletedLevel={location.state?.justCompletedLevel} onLevelClick={level => navigate(`/question/${level}`)} />
      {active && round && <div className="panel round-summary"><div className="row"><div><h2>Round {round.level}</h2><p className="muted">{decision ? 'Your time cap has passed. Choose how to proceed.' : round.continued ? 'Overtime is running. Your available reward keeps decreasing.' : 'Solve within your allowance to collect full points.'}</p></div><span className="badge badge-lime">{availablePoints} pts available</span></div><div className="row"><span>Base allowance: {event.config.round_minutes[round.level - 1]} min</span><button className="btn btn-primary" onClick={() => navigate(`/question/${round.level}`)}>{decision ? 'Continue or skip' : 'Open current round'}<ArrowRight size={18} /></button></div></div>}
      {(finished || ended) && <section className="panel" style={{ marginTop:26 }}><div className="row between"><h2>Round outcomes</h2><button className="btn btn-secondary" onClick={() => navigate('/leaderboard')}><Trophy size={18} /> View rankings</button></div><div className="outcome-list">{[1,2,3,4,5].map(level => { const outcome = outcomes.find(o => o.level === level); return <div className="outcome-row" key={level}><span>Round {level} <strong>{outcome ? outcome.status === 'solved' ? 'Solved' : 'Skipped' : 'Unfinished'}</strong></span><strong>{outcome ? `${outcome.points >= 0 ? '+' : ''}${outcome.points} pts` : '0 pts'}</strong></div>; })}</div></section>}
    </section><aside className="dashboard-aside stack"><div className="panel panel-lime"><div className="row"><Check size={19} /><strong>Team score</strong></div><p className="score-number">{team?.total_points ?? 0}</p><p>{outcomes.length} of 5 rounds settled</p></div><div className="panel"><h3>{team?.team_name}</h3><ul className="team-list"><li>{team?.leader_name} <span className="muted small">Leader</span></li>{team?.members?.map((member,index) => <li key={index}>{member}</li>)}</ul><p className="muted small" style={{ marginTop:16 }}>Browsing allowed. Work together on this device.</p></div>{outcomes.at(-1) && <div className="notice"><strong>Last round: {outcomes.at(-1).status}</strong><p>{outcomes.at(-1).points >= 0 ? '+' : ''}{outcomes.at(-1).points} pts · {formatClock(outcomes.at(-1).carry_ms)} carried forward</p></div>}</aside></div>
  </main>{showRules && <TutorialModal onClose={() => setShowRules(false)} />}</div>;
}
