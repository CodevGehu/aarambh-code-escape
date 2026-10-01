import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import GlassCard from '../components/GlassCard';
import api from '../lib/api';
import { Send, ArrowLeft, Award, Loader } from 'lucide-react';

const levelNames = ['', 'East Blue', 'Grand Line', 'Skypiea', 'New World', 'Laugh Tale'];

export default function QuestionPage() {
  const { level } = useParams();
  const levelNum = parseInt(level);
  const navigate = useNavigate();
  const { team, refreshTeam } = useAuth();

  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // 'correct' | 'incorrect' | 'already_done' | 'failed' | null
  const [shakeClass, setShakeClass] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [serverError, setServerError] = useState(null);

  const inputRef = useRef(null);

  // Fetch question
  useEffect(() => {
    const fetchQuestion = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/questions/${levelNum}`);
        setQuestion(res.data.question);
      } catch (err) {
        console.error('Error fetching question:', err);
        if (err.response?.status === 403) {
          navigate('/dashboard');
        }
      } finally {
        setLoading(false);
      }
    };

    if (team?._id) {
      fetchQuestion();
    }
  }, [team?._id, levelNum]);

  // Focus input on load
  useEffect(() => {
    if (!loading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [loading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!answer.trim() || submitting || !question) return;

    setSubmitting(true);
    setFeedback(null);

    try {
      // Submit answer directly to backend for validation
      const res = await api.post('/progress/submit', {
        level: levelNum,
        answer: answer.trim()
      });

      if (res.data.success) {
        // Await state refresh BEFORE celebrating
        await refreshTeam();

        setFeedback('correct');
        setShowConfetti(true);

        // Redirect after celebration, injecting the completed level into router state
        setTimeout(() => {
          navigate('/dashboard', { state: { justCompletedLevel: levelNum } });
        }, 2500);
      } else {
        setFeedback('failed');
      }
    } catch (err) {
      console.error('Submission error:', err);
      
      const errCode = err.response?.data?.code;
      const errMsg = err.response?.data?.error || '';
      const isIncorrect = errCode === 'INCORRECT_ANSWER' || errMsg.toLowerCase().includes('incorrect');
      const isLevelMismatch = errMsg.toLowerCase().includes('current level') || errMsg.toLowerCase().includes('already');

      if (err.response?.status === 400 && isIncorrect) {
        setFeedback('incorrect');
        setShakeClass('animate-shake');
        setTimeout(() => {
          setShakeClass('');
          setFeedback(null);
        }, 1500);
      } else if (err.response?.status === 400 && isLevelMismatch) {
        // This level was already submitted — show polished in-app message
        setFeedback('already_done');
      } else {
        setServerError(errMsg || 'Failed to submit answer. Please try again.');
        setFeedback('failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Generate confetti pieces
  const renderConfetti = () => {
    if (!showConfetti) return null;
    const colors = ['#D4A843', '#E8C76A', '#C62828', '#4CAF50', '#2196F3', '#FF9800'];
    return Array.from({ length: 40 }, (_, i) => (
      <div
        key={i}
        className="confetti-piece"
        style={{
          left: `${Math.random() * 100}vw`,
          background: colors[i % colors.length],
          animationDelay: `${Math.random() * 0.8}s`,
          animationDuration: `${2 + Math.random() * 1.5}s`,
          width: `${6 + Math.random() * 8}px`,
          height: `${6 + Math.random() * 8}px`,
          borderRadius: Math.random() > 0.5 ? '50%' : '2px'
        }}
      />
    ));
  };

  // Determine if team is visiting a COMPLETED level
  const isAlreadyCompleted = team?.current_level > levelNum || (team?.current_level >= 6 && levelNum <= 5);

  return (
    <div className="page" id="question-page">
      <div className="app-background" style={{ backgroundImage: "url('/card-question-bg.webp')" }} />
      <div className="app-overlay" style={{ background: 'rgba(10, 22, 40, 0.4)' }} />
      <Navbar />

      {/* Confetti */}
      {renderConfetti()}

      {/* Success flash */}
      {feedback === 'correct' && <div className="success-flash" />}

      <div className="page-content">
        <div className="container" style={{ maxWidth: '720px' }}>
          {/* Back button */}
          <button
            className="btn btn-ghost animate-fade-in"
            onClick={() => navigate('/dashboard')}
            style={{ marginBottom: 'var(--space-lg)', padding: '8px 16px', fontSize: '0.85rem' }}
            id="btn-back"
          >
            <ArrowLeft size={18} /> Back to Map
          </button>

          {/* Already Completed — show polished message instead of the question */}
          {isAlreadyCompleted ? (
            <div className="animate-scale-in" style={{
              background: 'rgba(76, 175, 80, 0.06)',
              border: '1px solid rgba(76, 175, 80, 0.35)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-2xl)',
              textAlign: 'center',
              backdropFilter: 'blur(16px)',
            }}>
              <div style={{ fontSize: '3.5rem', marginBottom: 'var(--space-md)' }}>⚓</div>
              <h2 style={{ color: '#81C784', marginBottom: 'var(--space-sm)', fontSize: '1.6rem' }}>
                Level {levelNum} — Conquered!
              </h2>
              <p style={{ color: 'rgba(245,230,200,0.7)', marginBottom: 'var(--space-lg)', maxWidth: '400px', margin: '0 auto var(--space-lg)' }}>
                Your crew already claimed the treasure from <strong style={{ color: 'var(--color-gold)' }}>{levelNames[levelNum]}</strong>. 
                Don't be greedy, pirate — there are more seas to sail!
              </p>
              {team?.level_points?.[levelNum] !== undefined && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  background: 'rgba(212, 168, 67, 0.12)', border: '1px solid rgba(212,168,67,0.3)',
                  borderRadius: 'var(--radius-full)', padding: '8px 20px',
                  color: 'var(--color-gold)', fontWeight: '700', fontSize: '1rem', marginBottom: 'var(--space-xl)'
                }}>
                  <Award size={18} /> +{team.level_points[levelNum]} pts earned
                </div>
              )}
              <div>
                <button className="btn btn-primary" onClick={() => navigate('/dashboard')} style={{ padding: '12px 32px' }}>
                  Back to Map
                </button>
              </div>
            </div>
          ) : loading ? (
            <div className="flex-center" style={{ minHeight: '40vh' }}>
              <Loader size={40} className="animate-spin" color="var(--color-gold)" />
            </div>
          ) : question ? (
            <GlassCard
              className={`animate-scale-in ${shakeClass}`}
              style={{ maxWidth: '100%' }}
              id="question-card"
            >
              {/* Level header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-lg)',
                paddingBottom: 'var(--space-md)',
                borderBottom: '1px solid rgba(212, 168, 67, 0.15)'
              }}>
                <div>
                  <p style={{
                    fontSize: '0.8rem',
                    textTransform: 'uppercase',
                    letterSpacing: '2px',
                    color: 'rgba(245, 230, 200, 0.5)',
                    marginBottom: '4px'
                  }}>
                    Level {levelNum}
                  </p>
                  <h2 style={{ fontSize: '1.5rem' }}>{levelNames[levelNum]}</h2>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(212, 168, 67, 0.15)',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-full)',
                  color: 'var(--color-gold)',
                  fontWeight: '700',
                  fontSize: '0.95rem'
                }}>
                  <Award size={18} />
                  {question.points} pts
                </div>
              </div>

              {/* Question text */}
              <div style={{ 
                marginBottom: 'var(--space-2xl)',
                background: 'rgba(0, 0, 0, 0.65)',
                padding: 'var(--space-lg)',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                border: '1px solid rgba(212, 168, 67, 0.3)'
              }}>
                <p style={{
                  fontSize: '1.3rem',
                  lineHeight: '1.8',
                  color: '#FFFFFF',
                  fontWeight: '600',
                  textShadow: '0 2px 4px rgba(0,0,0,0.8)'
                }}>
                  {question.question_text}
                </p>
              </div>

              {/* Answer form */}
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 'var(--space-lg)' }}>
                  <input
                    ref={inputRef}
                    type="text"
                    className="input"
                    placeholder="Type your answer here..."
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    disabled={submitting}
                    autoComplete="off"
                    id="answer-input"
                    style={{
                      fontSize: '1.05rem',
                      borderColor: feedback === 'correct'
                        ? 'var(--color-green-light)'
                        : feedback === 'incorrect'
                        ? 'var(--color-red-light)'
                        : undefined
                    }}
                  />
                </div>

                {/* Feedback */}
                {feedback === 'incorrect' && (
                  <p className="animate-fade-in" style={{
                    color: 'var(--color-red-light)',
                    fontSize: '0.9rem',
                    marginBottom: 'var(--space-md)',
                    fontWeight: '600'
                  }}>
                    ❌ Incorrect! Try again, pirate!
                  </p>
                )}

                {feedback === 'correct' && (
                  <p className="animate-fade-in" style={{
                    color: 'var(--color-green-light)',
                    fontSize: '1.1rem',
                    marginBottom: 'var(--space-md)',
                    fontWeight: '700'
                  }}>
                    🎉 Correct! +{question.points} points!
                  </p>
                )}

                {feedback === 'already_done' && (
                  <p className="animate-fade-in" style={{
                    color: '#E8C76A',
                    fontSize: '0.9rem',
                    marginBottom: 'var(--space-md)',
                    fontWeight: '600'
                  }}>
                    ⚓ This level is already complete! Sail to the next island.
                  </p>
                )}

                {feedback === 'failed' && (
                  <p className="animate-fade-in" style={{
                    color: '#FF9800',
                    fontSize: '0.9rem',
                    marginBottom: 'var(--space-md)',
                    fontWeight: '600'
                  }}>
                    ⚠️ {serverError || 'Server rejected the submission. Try again.'}
                  </p>
                )}

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!answer.trim() || submitting}
                  id="btn-submit-answer"
                  style={{ width: '100%', padding: '16px', fontSize: '1rem' }}
                >
                  {submitting ? (
                    <>
                      <Loader size={18} className="animate-spin" />
                      Saving Progress...
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      Submit Answer
                    </>
                  )}
                </button>
              </form>
            </GlassCard>
          ) : (
            <GlassCard style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>
              <p>No question available for this level.</p>
              <button className="btn btn-primary" onClick={() => navigate('/dashboard')} style={{ marginTop: 'var(--space-lg)' }}>
                Return to Map
              </button>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}
