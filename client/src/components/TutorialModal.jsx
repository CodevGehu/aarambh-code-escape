import { useState, useEffect } from 'react';
import { ChevronRight, X, Anchor, Swords, Map, Compass, Flag } from 'lucide-react';

const tutorialSteps = [
  {
    icon: Anchor,
    image: '/tutorial/1.png',
    title: 'Welcome Aboard, Pirate!',
    description: 'You\'re about to embark on a Technical Treasure Hunt!\n\nYour crew will navigate through 5 challenging levels to find the ultimate treasure.',
    accent: '#D4A843'
  },
  {
    icon: Swords,
    image: '/tutorial/2.png',
    title: 'How It Works',
    description: 'Each level has a unique question. Answer correctly to earn points and unlock the next level.\n\nOnly 1 question per level — make it count!',
    accent: '#E53935',
    highlightHint: 'We can move to 2 if you want to do'
  },
  {
    icon: Map,
    image: '/tutorial/3.png',
    title: 'Level Progression',
    description: 'Levels unlock sequentially. You must complete Level 1 before Level 2, and so on.\n\nEach level is worth more points than the last!',
    accent: '#4CAF50'
  },
  {
    icon: Compass,
    image: '/tutorial/4.png',
    title: 'The Leaderboard',
    description: 'Teams are ranked by total points. If there\'s a tie, the faster team wins!\n\nKeep an eye on the leaderboard to track your rivals.',
    accent: '#2196F3'
  },
  {
    icon: Flag,
    image: '/tutorial/5.png',
    title: 'Ready to Set Sail?',
    description: 'Head to Level 1 and start your adventure. May the best crew win!\n\nRemember — only the Team Leader can submit answers.',
    accent: '#D4A843'
  }
];

export default function TutorialModal({ onClose }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const step = tutorialSteps[currentStep];
  const StepIcon = step.icon;
  const isLast = currentStep === tutorialSteps.length - 1;

  const handleNext = () => {
    if (isLast) {
      handleClose();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem('tutorial_dismissed', 'true');
    }
    onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [dontShowAgain]);

  return (
    <div className="tutorial-overlay animate-fade-in" id="tutorial-modal">
      <div className="tutorial-card animate-scale-in">
        {/* Close button */}
        <button className="tutorial-close" onClick={handleClose} id="tutorial-close">
          <X size={20} />
        </button>

        <div className="tutorial-body">
          <div className="tutorial-left">
            {/* Icon area */}
            <div className="tutorial-icon-area" style={{ borderColor: step.accent }}>
              <StepIcon size={40} color={step.accent} />
            </div>

            {/* Content */}
            <div className="tutorial-content">
              <h2 style={{ color: step.accent, fontSize: '1.6rem', marginBottom: '12px' }}>
                {step.title}
              </h2>
              <p style={{ fontSize: '1rem', lineHeight: '1.7', color: 'rgba(245, 230, 200, 0.9)', whiteSpace: 'pre-line' }}>
                {step.description}
              </p>
              {step.highlightHint && (
                <div className="animate-fade-in-up" style={{
                  marginTop: '16px',
                  padding: '12px 16px',
                  background: 'rgba(212, 168, 67, 0.08)',
                  borderLeft: `4px solid ${step.accent}`,
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.9rem',
                  lineHeight: '1.5',
                  fontWeight: '500',
                  color: 'var(--color-parchment)'
                }}>
                  <span style={{ color: step.accent, display: 'block', marginBottom: '4px', fontWeight: '800', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '1px' }}>⚡ Secret Tip</span>
                  {step.highlightHint}
                </div>
              )}
            </div>

            {/* Progress dots */}
            <div className="tutorial-dots">
              {tutorialSteps.map((_, i) => (
                <div
                  key={i}
                  className={`tutorial-dot ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'completed' : ''}`}
                  style={i === currentStep ? { background: step.accent } : {}}
                  onClick={() => setCurrentStep(i)}
                />
              ))}
            </div>

            {/* Footer */}
            <div className="tutorial-footer">
              <label className="tutorial-dismiss">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                />
                Don't show again
              </label>

              <button className="btn btn-primary" onClick={handleNext} id="tutorial-next">
                {isLast ? 'Start Adventure!' : 'Next'}
                {!isLast && <ChevronRight size={18} />}
              </button>
            </div>
          </div>

          {/* Right side: Image */}
          {step.image && (
            <div className="tutorial-right">
              <div className="tutorial-character-area">
                <img
                  src={step.image}
                  key={step.image}
                  alt="Tutorial Illustration"
                  className="animate-fade-in"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .tutorial-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          padding: var(--space-lg);
        }
        .tutorial-card {
          position: relative;
          width: 100%;
          max-width: 580px;
          background: var(--glass-bg);
          backdrop-filter: var(--glass-blur);
          -webkit-backdrop-filter: var(--glass-blur);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-xl);
          padding: var(--space-2xl);
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);
        }
        .tutorial-body {
          display: flex;
          flex-direction: column-reverse; /* Mobile: text below image or text above */
          gap: var(--space-xl);
        }
        .tutorial-left {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .tutorial-right {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        @media (min-width: 768px) {
          .tutorial-card {
            max-width: 760px;
          }
          .tutorial-body {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
          }
          .tutorial-left {
            align-items: flex-start;
            text-align: left;
            padding-right: var(--space-lg);
          }
          .tutorial-right {
            flex: 0 0 240px;
          }
        }
        .tutorial-close {
          position: absolute;
          top: 16px;
          right: 16px;
          background: none;
          border: none;
          color: rgba(245, 230, 200, 0.5);
          cursor: pointer;
          padding: 4px;
          transition: color var(--transition-fast);
          z-index: 20;
        }
        .tutorial-close:hover {
          color: var(--color-parchment);
        }
        .tutorial-icon-area {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          border: 2px solid;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: var(--space-lg);
          background: rgba(10, 22, 40, 0.5);
        }
        @media (min-width: 768px) {
          .tutorial-icon-area {
            width: 80px;
            height: 80px;
          }
        }
        .tutorial-character-area {
          width: 320px;
          height: 320px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .tutorial-character-area img {
          max-width: 100%;
          height: auto;
          max-height: 380px;
          object-fit: contain;
          filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.4));
          transform: scale(1.2);
        }
        .tutorial-content {
          margin-bottom: var(--space-xl);
          width: 100%;
        }
        .tutorial-dots {
          display: flex;
          gap: 8px;
          margin-bottom: var(--space-xl);
        }
        .tutorial-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: rgba(245, 230, 200, 0.2);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .tutorial-dot.active {
          transform: scale(1.3);
        }
        .tutorial-dot.completed {
          background: rgba(245, 230, 200, 0.5);
        }
        .tutorial-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          gap: var(--space-md);
        }
        .tutorial-dismiss {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8rem;
          color: rgba(245, 230, 200, 0.5);
          cursor: pointer;
          user-select: none;
        }
        .tutorial-dismiss input {
          accent-color: var(--color-gold);
        }
      `}</style>
    </div>
  );
}
