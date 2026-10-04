import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGameClock, formatClock } from '../lib/gameClock';
import GameClocks from '../components/GameClocks';
import Navbar from '../components/Navbar';
import api from '../lib/api';
import { downloadPackingTool } from '../lib/downloadPackingTool';
import ErrorPage from './ErrorPage';
import PuzzleWorkbench, { initialPuzzleSubmission, restorePuzzleSubmission } from '../components/puzzles/PuzzleWorkbench';
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
  const [puzzleDraft, setPuzzleDraft] = useState(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null), [result, setResult] = useState(null);
  const [confirmSkip, setConfirmSkip] = useState(false), [retry, setRetry] = useState(0);
  const current = team?.current_level === level;
  const outcome = result || team?.outcomes?.find(o => o.level === level);
  const active = event?.status === 'active' && !ended;
  useEffect(() => {
    let alive = true;
    setQuestion(null); setAnswer(''); setPuzzleDraft(null); setFeedback(null); setResult(null); setConfirmSkip(false);
    if (!current || !active) { setLoading(false); return; }
    setLoading(true);
    api.get(`/questions/${level}`).then(res => {
      if (!alive) return;
      const next = res.data.question;
      setQuestion(next);
      if (next.puzzle) {
        let draft = initialPuzzleSubmission(next.puzzle);
        try {
          const saved = localStorage.getItem(`escape-puzzle:${next.puzzle.instance_id}`);
          if (saved && saved.length <= 9000) draft = restorePuzzleSubmission(next.puzzle, JSON.parse(saved));
        } catch { /* A blocked or corrupt local save must not prevent opening the room. */ }
        setPuzzleDraft(draft);
      }
    })
      .catch(err => { if (alive) setFeedback({ type:'error', text:err.response?.data?.error || 'Unable to load this clue. Retry when connected.' }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [level, current, active, retry]);
  useEffect(() => {
    if (!question?.puzzle || question.puzzle.locked || !puzzleDraft) return;
    try { localStorage.setItem(`escape-puzzle:${question.puzzle.instance_id}`, JSON.stringify(puzzleDraft)); }
    catch { /* Play remains available when local storage is unavailable. */ }
  }, [question, puzzleDraft]);
  async function discover(discovery_submission) {
    if (busy || decision || !active || !current) return;
    setBusy(true); setFeedback(null);
    try {
      const response = await api.post(`/questions/${question._id}/discover`, { discovery_submission });
      const puzzle = response.data.puzzle;
      setQuestion(previous => ({ ...previous, puzzle }));
      let draft = initialPuzzleSubmission(puzzle);
      try {
        const saved = localStorage.getItem(`escape-puzzle:${puzzle.instance_id}`);
        if (saved && saved.length <= 9000) draft = restorePuzzleSubmission(puzzle, JSON.parse(saved));
      } catch { /* A failed optional draft restore leaves a fresh workbench. */ }
      setPuzzleDraft(draft);
      setFeedback({ type: 'success', text: response.data.message });
    } catch (err) { setFeedback({ type: 'error', text: err.response?.data?.error || 'Unable to check the resource. Retry when connected.' }); }
    finally { setBusy(false); }
  }
  async function action(kind, e) {
    e?.preventDefault();
    if (busy) return;
    if (kind === 'submit' && (question?.puzzle ? !puzzleDraft || question.puzzle.locked : !answer.trim())) return;
    setBusy(true); setFeedback(null);
    try {
      const res = await api.post(`/progress/${kind}`, { level, ...(kind === 'submit' ?
        question?.puzzle ? { question_id: String(question._id), puzzle_submission:puzzleDraft } : { answer:answer.trim() } : {}) });
      if (!res.data.success) throw new Error('Your action was not accepted. Please retry.');
      acceptSnapshot(res.data);
      if (kind === 'continue') {
        setFeedback({ type:'success', text:'Overtime enabled. You can keep answering; the reward decreases until you solve or skip.' });
      } else {
        if (question?.puzzle) {
          try { localStorage.removeItem(`escape-puzzle:${question.puzzle.instance_id}`); } catch { /* Optional draft cleanup. */ }
        }
        setResult(res.data.outcome);
        navigate('/dashboard', { state:{ justCompletedLevel:level } });
      }
      setConfirmSkip(false);
    } catch (err) {
      setFeedback({ type:'error', text:err.response?.data?.error || err.message || 'Connection interrupted. Check your team progress before trying again.' });
      await refreshTeam();
    } finally { setBusy(false); }
  }
  async function downloadTool() {
    if (busy || decision || !active || !current || question?.puzzle?.locked) return;
    setBusy(true); setFeedback(null);
    try { await downloadPackingTool(`/questions/${question._id}/tool`); }
    catch { setFeedback({ type: 'error', text: 'Unable to download the tool. Refresh your round and retry.' }); }
    finally { setBusy(false); }
  }
  return <div className="page"><Navbar /><main className="container page-content">
    <button className="btn btn-ghost" onClick={() => navigate('/dashboard')}><ArrowLeft size={17} /> Back to rooms</button>
    <GameClocks game={game} />
    {error && <p className="notice notice-error" role="alert" style={{ marginBottom:20 }}>{error}</p>}
    {ended ? <section className="panel"><h1>The event has ended.</h1><p style={{ margin:'20px 0' }}>Answer submissions are closed. Your recorded answers and score are saved.</p><button className="btn btn-primary" onClick={() => navigate('/dashboard')}>View your results</button></section> : outcome ? <section className="panel panel-lime"><Check size={30} /><h2>Round {level} {outcome.status === 'skipped' ? 'skipped' : 'solved'}.</h2><p style={{ margin:'18px 0' }}>{outcome.points >= 0 ? '+' : ''}{outcome.points} points recorded. {formatClock(outcome.carry_ms)} saved for the next round.</p><button className="btn btn-primary" onClick={() => navigate('/dashboard', { state:{ justCompletedLevel:level } })}>See your next room <ArrowRight size={18} /></button></section> : !current || !active ? <section className="panel"><h2>{event?.status === 'not_started' ? 'Waiting for the shared start.' : 'This room is locked.'}</h2><p style={{ margin:'18px 0' }}>Return to your path to open the current round.</p><button className="btn btn-primary" onClick={() => navigate('/dashboard')}>Back to rooms</button></section> : <div className="question-layout"><section className="question-paper">
      <div className="terminal-label"><span className="terminal-dots" aria-hidden="true"><i /><i /><i /></span>room_{String(level).padStart(2,'0')}.txt</div><div className="question-body">
        <div className="row between"><h1 style={{ fontSize:'2.4rem' }}>Round {level}</h1><span className="badge badge-lime">{availablePoints ?? '…'} pts available</span></div>
        {loading ? <p role="status" className="muted" style={{ margin:'30px 0' }}>Loading your clue…</p> : question ? <>{!question.puzzle?.locked && question.question_text !== question.puzzle?.title && <p className="question-text">{question.question_text}</p>}
          {question.puzzle && puzzleDraft && <PuzzleWorkbench puzzle={question.puzzle} draft={puzzleDraft} onDiscover={discover} onDownloadTool={downloadTool} onChange={next => { setPuzzleDraft(next); setFeedback(null); }} disabled={busy || decision || !active || !current} />}
          <form className="answer-form" onSubmit={e => action('submit', e)}>{!question.puzzle && <><label htmlFor="answer-input">Your answer</label><input className="input" id="answer-input" value={answer} onChange={e => setAnswer(e.target.value)} autoComplete="off" disabled={busy || decision} placeholder="Enter the exact answer" maxLength={2000} /></>}
            <button className="btn btn-primary" id="btn-submit-answer" disabled={busy || decision || (question.puzzle ? !puzzleDraft || question.puzzle.locked : !answer.trim())}><Send size={17} />{busy ? 'Saving…' : question.puzzle ? 'Submit solution' : 'Submit answer'}</button>
            {question.puzzle && <p className="muted small">Your work is saved on this device. Submit solution checks the puzzle and records your round score.</p>}
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
