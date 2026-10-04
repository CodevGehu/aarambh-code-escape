import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import PuzzleWorkbench, { initialPuzzleSubmission } from '../components/puzzles/PuzzleWorkbench';

export default function PuzzleLabPage() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [selected, setSelected] = useState('');
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [retry, setRetry] = useState(0);
  const question = questions.find(item => item._id === selected);
  useEffect(() => {
    let alive = true;
    setLoading(true); setFeedback(null);
    api.get('/admin/puzzles').then(response => {
      if (!alive) return;
      setQuestions(response.data.questions);
      const first = response.data.questions[0];
      if (first) { setSelected(first._id); setDraft(initialPuzzleSubmission(first.puzzle)); }
    }).catch(error => {
      if (!alive) return;
      if (error.response?.status === 401) navigate('/admin', { replace: true });
      else setFeedback({ valid: false, message: error.response?.data?.error || 'Unable to load the rehearsal puzzles. Retry when connected.' });
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [navigate, retry]);
  function select(item) {
    setSelected(item._id); setDraft({ ...initialPuzzleSubmission(item.puzzle), ...(item.discovery_submission ? { discovery_submission: item.discovery_submission } : {}) }); setFeedback(null);
  }
  async function discover(discovery_submission) {
    if (busy || !question) return;
    setBusy(true); setFeedback(null);
    try {
      const response = await api.post(`/admin/puzzles/${question._id}/discover`, { discovery_submission });
      setQuestions(items => items.map(item => item._id === question._id ? { ...item, puzzle: response.data.puzzle, discovery_submission } : item));
      setDraft({ ...initialPuzzleSubmission(response.data.puzzle), discovery_submission });
      setFeedback({ valid: true, message: response.data.message });
    } catch (error) { setFeedback({ valid: false, message: error.response?.data?.error || 'Unable to check the resource. Retry when connected.' }); }
    finally { setBusy(false); }
  }
  async function check() {
    if (busy || !draft || !question || question.puzzle.locked) return;
    setBusy(true); setFeedback(null);
    try {
      const response = await api.post(`/admin/puzzles/${question._id}/check`, { puzzle_submission: draft });
      setFeedback(response.data);
    } catch (error) {
      setFeedback({ valid: false, message: error.response?.data?.message || error.response?.data?.error || 'Unable to check the solution. Your work is still on this page.' });
    } finally { setBusy(false); }
  }
  return <div className="page"><main className="container page-content">
    <Link className="btn btn-ghost" to="/admin">Back to control room</Link>
    <div className="page-heading" style={{ marginTop: 24 }}><h1>Puzzle rehearsal</h1>
      <p>Try the six new rooms before the event. Checks use the competition rules and leave team progress and scores untouched.</p></div>
    <p className="notice" style={{ marginBottom: 24 }}>These are rehearsal questions. Their difficulty and timing need a pilot with teams using the internet and AI.</p>
    {loading ? <p role="status">Loading puzzle workbenches…</p> : <>
      <nav className="puzzle-lab-nav" aria-label="Rehearsal rooms">{questions.map(item => <button key={item._id}
        className={`btn ${item._id === selected ? 'btn-primary' : ''}`} aria-pressed={item._id === selected}
        disabled={busy} onClick={() => select(item)}>Set {item.set_id.slice(1)} · Round {item.level}<br />{item.puzzle.title}</button>)}</nav>
      {question && draft && <section className="question-paper" style={{ marginTop: 24 }}><div className="question-body">
        {question.question_text !== question.puzzle.title && <p className="question-text">{question.question_text}</p>}
        <PuzzleWorkbench key={question._id} puzzle={question.puzzle} draft={draft} onDiscover={discover} onChange={next => { setDraft({ ...next, ...(draft?.discovery_submission ? { discovery_submission: draft.discovery_submission } : {}) }); setFeedback(null); }} disabled={busy} />
        <div className="answer-form"><button className="btn btn-primary" onClick={check} disabled={busy || question.puzzle.locked}>{busy ? 'Checking…' : 'Check rehearsal solution'}</button></div>
      </div></section>}
      {!question && <button className="btn" onClick={() => setRetry(value => value + 1)}>Retry loading puzzles</button>}
    </>}
    {feedback && <p role="status" className={`notice ${feedback.valid ? 'notice-success' : 'notice-error'}`} style={{ marginTop: 20 }}>{feedback.message}</p>}
  </main></div>;
}
