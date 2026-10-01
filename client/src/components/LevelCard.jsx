import { Lock, CheckCircle, Play, Star } from 'lucide-react';

const levelNames = [
  '', // index 0 unused
  'East Blue',
  'Grand Line',
  'Skypiea',
  'New World',
  'Laugh Tale'
];

const levelDescriptions = [
  '',
  'Begin your journey!',
  'The real adventure starts.',
  'Reach for the skies!',
  'Only the strong survive.',
  'The final treasure awaits!'
];

export default function LevelCard({ level, currentLevel, points, onClick }) {
  const isCompleted = level < currentLevel;
  const isCurrent = level === currentLevel;
  const isLocked = level > currentLevel;
  const gameFinished = currentLevel >= 6;

  let statusClass = 'level-card-locked';
  let StatusIcon = Lock;
  let statusLabel = 'Locked';

  if (isCompleted || (level <= 5 && gameFinished)) {
    statusClass = 'level-card-completed';
    StatusIcon = CheckCircle;
    statusLabel = 'Completed';
  } else if (isCurrent) {
    statusClass = 'level-card-current';
    StatusIcon = Play;
    statusLabel = 'Current';
  }

  return (
    <div
      className={`level-card ${statusClass} ${isCurrent ? 'animate-pulse-glow' : ''}`}
      onClick={() => {
        if (isCurrent) onClick?.(level);
      }}
      style={{ cursor: isCurrent ? 'pointer' : 'default' }}
      id={`level-card-${level}`}
    >
      <div className="level-card-header">
        <div className="level-number">
          <Star size={14} style={{ opacity: 0.6 }} />
          Level {level}
        </div>
        <StatusIcon
          size={22}
          className={`level-icon ${isCompleted || (level <= 5 && gameFinished) ? 'text-green' : isCurrent ? 'text-gold' : ''}`}
        />
      </div>

      <h3 className="level-name">{levelNames[level]}</h3>
      <p className="level-desc">{levelDescriptions[level]}</p>

      <div className="level-footer">
        {(isCompleted || (level <= 5 && gameFinished)) && (
          <span className="level-points text-green">
            +{points || '—'} pts
          </span>
        )}
        {isCurrent && (
          <span className="level-badge">
            ▶ Start Challenge
          </span>
        )}
        {isLocked && !gameFinished && (
          <span className="level-locked-text">
            🔒 Complete Level {level - 1} first
          </span>
        )}
      </div>

      <style>{`
        .level-card {
          background: var(--glass-bg);
          backdrop-filter: var(--glass-blur);
          -webkit-backdrop-filter: var(--glass-blur);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          padding: var(--space-lg);
          transition: all var(--transition-base);
          position: relative;
          overflow: hidden;
        }
        .level-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, transparent, var(--color-gold), transparent);
          opacity: 0;
          transition: opacity var(--transition-base);
        }
        .level-card-current {
          border-color: var(--color-gold);
        }
        .level-card-current::before {
          opacity: 1;
        }
        .level-card-current:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(212, 168, 67, 0.3);
        }
        .level-card-completed {
          border-color: rgba(76, 175, 80, 0.4);
        }
        .level-card-completed::before {
          opacity: 1;
          background: linear-gradient(90deg, transparent, var(--color-green-light), transparent);
        }
        .level-card-locked {
          opacity: 0.5;
        }
        .level-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-sm);
        }
        .level-number {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: rgba(245, 230, 200, 0.6);
          font-weight: 600;
        }
        .level-name {
          font-size: 1.3rem;
          margin-bottom: var(--space-xs);
        }
        .level-desc {
          font-size: 0.85rem;
          margin-bottom: var(--space-md);
          color: rgba(245, 230, 200, 0.5);
        }
        .level-footer {
          font-size: 0.85rem;
          font-weight: 600;
        }
        .level-points {
          font-weight: 700;
        }
        .level-badge {
          color: var(--color-gold);
          font-weight: 700;
          letter-spacing: 0.5px;
        }
        .level-locked-text {
          color: rgba(245, 230, 200, 0.4);
          font-size: 0.8rem;
        }
      `}</style>
    </div>
  );
}
