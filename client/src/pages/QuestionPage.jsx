import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGameClock, formatClock } from '../lib/gameClock';
import GameClocks from '../components/GameClocks';
import Navbar from '../components/Navbar';
import api from '../lib/api';
import ErrorPage from './ErrorPage';
import { ArrowLeft, ArrowRight, Send, SkipForward, Check } from 'lucide-react';

export default function QuestionPage() {
  const { level } = useParams();
  if (!/^[1-5]$/.test(level || '')) return <ErrorPage title="That room isn’t on the route." message="Code Escape has five rooms. Return to your dashboard to open your current round." />;
  return <QuestionRoundPage />;
}

function QuestionRoundPage() {
  const level = Number(useParams().level);
  const navigate = useNavigate();
  const { acceptSnapshot, refreshTeam } = useAuth();
  const game = useGameClock();
  const { team, event, round, ended, decision, expired, availablePoints, error } = game;
  const [question, setQuestion] = useState(null), [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null), [result, setResult] = useState(null);
  const [confirmSkip, setConfirmSkip] = useState(false), [retry, setRetry] = useState(0);
  const current = team?.current_level === level;
  const outcome = result || team?.outcomes?.find(o => o.level === level);
  const active = event?.status === 'active' && !ended;
  useEffect(() => {
    let alive = true;
    setQuestion(null); setAnswer(''); setFeedback(null); setResult(null); setConfirmSkip(false);
    if (!current || !active) { setLoading(false); return; }
    setLoading(true);
    api.get(`/questions/${level}`).then(res => { if (alive) setQuestion(res.data.question); })
      .catch(err => { if (alive) setFeedback({ type:'error', text:err.response?.data?.error || 'Unable to load this clue. Retry when connected.' }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [level, current, active, retry]);
  async function action(kind, e) {
    e?.preventDefault();
    if (busy) return;
    if (kind === 'submit' && !answer.trim()) return;
    setBusy(true); setFeedback(null);
    try {
      const res = await api.post(`/progress/${kind}`, { level, ...(kind === 'submit' ? { answer:answer.trim() } : {}) });
      if (!res.data.success) throw new Error('Your action was not accepted. Please retry.');
      acceptSnapshot(res.data);
      if (kind === 'continue') {
        setFeedback({ type:'success', text:'Overtime enabled. You can keep answering; the reward decreases until you solve or skip.' });
      } else {
        setResult(res.data.outcome);
        navigate('/dashboard', { state:{ justCompletedLevel:level } });
      }
      setConfirmSkip(false);
    } catch (err) {
      setFeedback({ type:'error', text:err.response?.data?.error || err.message || 'Connection interrupted. Check your team progress before trying again.' });
      await refreshTeam();
    } finally { setBusy(false); }
  }
  return <div className="page"><Navbar /><main className="container page-content">
    <button className="btn btn-ghost" onClick={() => navigate('/dashboard')}><ArrowLeft size={17} /> Back to rooms</button>
    <GameClocks game={game} />
    {error && <p className="notice notice-error" role="alert" style={{ marginBottom:20 }}>{error}</p>}
    {ended ? <section className="panel"><h1>The event has ended.</h1><p style={{ margin:'20px 0' }}>Answer submissions are closed. Your recorded answers and score are saved.</p><button className="btn btn-primary" onClick={() => navigate('/dashboard')}>View your results</button></section> : outcome ? <section className="panel panel-lime"><Check size={30} /><h2>Round {level} {outcome.status === 'skipped' ? 'skipped' : 'solved'}.</h2><p style={{ margin:'18px 0' }}>{outcome.points >= 0 ? '+' : ''}{outcome.points} points recorded. {formatClock(outcome.carry_ms)} saved for the next round.</p><button className="btn btn-primary" onClick={() => navigate('/dashboard', { state:{ justCompletedLevel:level } })}>See your next room <ArrowRight size={18} /></button></section> : !current || !active ? <section className="panel"><h2>{event?.status === 'not_started' ? 'Waiting for the shared start.' : 'This room is locked.'}</h2><p style={{ margin:'18px 0' }}>Return to your path to open the current round.</p><button className="btn btn-primary" onClick={() => navigate('/dashboard')}>Back to rooms</button></section> : <div className="question-layout"><section className="question-paper">
      <div className="terminal-label"><span className="terminal-dots" aria-hidden="true"><i /><i /><i /></span>room_{String(level).padStart(2,'0')}.txt</div><div className="question-body">
        <div className="row between"><h1 style={{ fontSize:'2.4rem' }}>Round {level}</h1><span className="badge badge-lime">{availablePoints ?? '…'} pts available</span></div>
        {loading ? <p role="status" className="muted" style={{ margin:'30px 0' }}>Loading your clue…</p> : question ? <><p className="question-text">{question.question_text}</p>
          <form className="answer-form" onSubmit={e => action('submit', e)}><label htmlFor="answer-input">Your answer</label><input className="input" id="answer-input" value={answer} onChange={e => setAnswer(e.target.value)} autoComplete="off" disabled={busy || decision} placeholder="Enter the exact answer" maxLength={2000} />
            <button className="btn btn-primary" id="btn-submit-answer" disabled={busy || decision || !answer.trim()}><Send size={17} />{busy ? 'Saving…' : 'Submit answer'}</button>
            {decision && <p className="muted small">Choose Continue or Skip below before submitting in overtime.</p>}
          </form>
        </> : <button className="btn" style={{ marginTop:24 }} onClick={() => setRetry(value => value + 1)}>Retry loading clue</button>}
        {feedback && <p role="status" className={`notice ${feedback.type === 'error' ? 'notice-error' : 'notice-success'}`} style={{ marginTop:18 }}>{feedback.text}</p>}
        {expired && round && <section className="choice-panel" aria-label="Overtime choices"><h2>{decision ? 'Your time cap has passed.' : 'Keep solving, or move on.'}</h2><p>Continue for up to <strong>{availablePoints} points now</strong>, decreasing at {event.config.overtime_decay_percent_per_minute}% of the base reward per minute to a {event.config.minimum_reward_percent}% minimum. Skipping deducts <strong>{round.skip_penalty} points</strong> and moves you forward.</p>
          {confirmSkip ? <div><p><strong>Skip round {level}?</strong> Your score will change from {team.total_points} to {team.total_points - round.skip_penalty}. This round cannot be reopened.</p><div className="row"><button className="btn btn-danger" disabled={busy} onClick={() => action('skip')}>Confirm skip: −{round.skip_penalty} pts</button><button className="btn" disabled={busy} onClick={() => setConfirmSkip(false)}>Keep this round</button></div></div> : <div className="row">{decision && <button className="btn btn-primary" disabled={busy} onClick={() => action('continue')}>Continue solving</button>}<button className="btn btn-danger" disabled={busy} onClick={() => setConfirmSkip(true)}><SkipForward size={17} /> Skip: −{round.skip_penalty} pts</button></div>}
        </section>}
      </div></section><aside className="stack"><div className="panel panel-lime"><strong>Current score</strong><p className="score-number">{team?.total_points ?? 0}</p></div><div className="panel"><h3>Round allowance</h3><p style={{ marginTop:14 }}>{event?.config.round_minutes[level - 1]} base minutes<br />+ {formatClock(round?.carry_ms)} saved time</p><p className="muted small" style={{ marginTop:16 }}>Your timer keeps running while you browse. Submit through this device.</p></div><div className="notice"><strong>Time carries forward.</strong><p className="small">Solving within the round cap adds the remaining round time to the next room. Overtime and skips carry zero saved time.</p></div></aside></div>}
  </main></div>;
}
