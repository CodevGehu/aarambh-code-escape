import { useState, useMemo } from 'react';
import { Lock, Play, CheckCircle } from 'lucide-react';
import '../styles/QuestMap.css';

const islandCoordinates = [
  null,                          // Level 0 unused
  { top: '24%', left: '14%' },  // 1. East Blue (leftmost)
  { top: '46%', left: '30%' },  // 2. Grand Line
  { top: '52%', left: '52%' },  // 3. Skypiea (center)
  { top: '36%', left: '62%' },  // 4. New World
  { top: '72%', left: '76%' },  // 5. Laugh Tale (rightmost)
];

const levelNames = ['', 'East Blue', 'Skypiea', 'Grand Line', 'New World', 'Laugh Tale'];
const levelPoints = ['', '100', '200', '300', '400', '500'];
const levelDesc = [
  '',
  'The starting sea — beginners\' waters.',
  'The sky island above the clouds.',
  'The legendary ocean of legends.',
  'The treacherous final sea.',
  'The island at the end of the world.',
];

const levelImages = [
  null,
  '/island.webp',
  '/island.webp',
  '/island.webp',
  '/island.webp',
  '/island.webp',
];

const hoverImages = [
  null,
  '/card-east-blue.webp',
  '/card-skypiea.webp',
  '/card-grand-line.webp',
  '/card-new-world.webp',
  '/card-laugh-tale.webp',
];

// Build a cubic bezier SVG path string between two percentage-based coords
// Points are given as { top: '72%', left: '76%' }
// We render in a viewBox="0 0 100 100" so we strip '%' and use values directly
function buildCurvePath(from, to, index) {
  const x1 = parseFloat(from.left);
  const y1 = parseFloat(from.top);
  const x2 = parseFloat(to.left);
  const y2 = parseFloat(to.top);

  // Control point offset alternates to create S-curve feel
  const sign = index % 2 === 0 ? 1 : -1;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const perpX = -dy * 0.18 * sign;
  const perpY = dx * 0.18 * sign;

  const cx = mx + perpX;
  const cy = my + perpY;

  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

export default function QuestMap({ currentLevel, gameFinished, onLevelClick, levelPoints: teamLevelPoints, justCompletedLevel }) {
  const [hoveredLevel, setHoveredLevel] = useState(null);

  const activeLevel = gameFinished ? 6 : (currentLevel || 1);
  const shipTargetLevel = Math.min(activeLevel, 5);
  const avatarPosition = islandCoordinates[shipTargetLevel] || islandCoordinates[1];
  
  // Custom alignment for hover cards near the edges of the screen
  const hoverShifts = {
    1: { shift: '-16%', arrow: '16%' },
    2: { shift: '-30%', arrow: '30%' },
    3: { shift: '-50%', arrow: '50%' },
    4: { shift: '-50%', arrow: '50%' },
    5: { shift: '-84%', arrow: '84%' },
  };

  // Generate perfect Bezier keyframes for ship sailing
  const animationStyle = useMemo(() => {
    if (!justCompletedLevel) return null;
    const startLevel = justCompletedLevel;
    const endLevel = Math.min(startLevel + 1, 5);
    const from = islandCoordinates[startLevel];
    const to = islandCoordinates[endLevel];
    if (!from || !to || startLevel === endLevel) return null;
    
    const index = startLevel - 1; 
    const x1 = parseFloat(from.left);
    const y1 = parseFloat(from.top);
    const x2 = parseFloat(to.left);
    const y2 = parseFloat(to.top);

    const sign = index % 2 === 0 ? 1 : -1;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const cx = mx + (-dy * 0.18 * sign);
    const cy = my + (dx * 0.18 * sign);

    const frames = [];
    for(let i=0; i<=20; i++) {
      const t = i / 20;
      const x = Math.pow(1-t, 2)*x1 + 2*(1-t)*t*cx + Math.pow(t, 2)*x2;
      const y = Math.pow(1-t, 2)*y1 + 2*(1-t)*t*cy + Math.pow(t, 2)*y2;
      frames.push(`${i*5}% { top: ${y}%; left: ${x}%; }`);
    }

    return `
      @keyframes shipSailAnim {
        ${frames.join('\n')}
      }
      .animating-ship {
        animation: shipSailAnim 3.5s cubic-bezier(0.3, 0, 0.2, 1) forwards !important;
        transition: none !important; /* Disable CSS transition while animating on curve */
      }
    `;
  }, [justCompletedLevel]);

  return (
    <div className="quest-map-wrapper">
      {animationStyle && <style>{animationStyle}</style>}
      <img src="/map.webp" alt="One Piece Map" className="quest-map-image" />

      <svg
        className="quest-map-paths"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.6)) drop-shadow(0 0 4px rgba(255,255,255,0.2))' }}
      >
        {islandCoordinates.slice(1, -1).map((coord, i) => {
          const nextCoord = islandCoordinates[i + 2];
          if (!coord || !nextCoord) return null;
          const isTraversed = (i + 1) < activeLevel; // path from level i+1 to i+2

          return (
            <path
              key={i}
              d={buildCurvePath(coord, nextCoord, i)}
              fill="none"
              stroke={isTraversed ? '#000000' : '#808080'}
              strokeWidth={isTraversed ? '1.2' : '0.8'}
              strokeDasharray="3 4"
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {/* Island Nodes */}
      {[1, 2, 3, 4, 5].map((level) => {
        const coords = islandCoordinates[level];
        const isCompleted = level < activeLevel || gameFinished;
        const isCurrent = level === activeLevel && !gameFinished;
        const isLocked = level > activeLevel && !gameFinished;
        const isHovered = hoveredLevel === level;

        // Points earned at this level from server data
        const earnedPoints = teamLevelPoints?.[level];
        const displayPoints = earnedPoints !== undefined ? earnedPoints : levelPoints[level];
        
        const shiftData = hoverShifts[level];

        let statusClass = 'island-locked';
        if (isCompleted) statusClass = 'island-completed';
        if (isCurrent) statusClass = 'island-current';

        const isClickable = isCompleted || isCurrent;

        return (
          <div
            key={level}
            className={`island-node ${statusClass}`}
            style={{ 
              top: coords.top, 
              left: coords.left,
              '--card-shift': shiftData.shift,
              '--card-arrow-pos': shiftData.arrow
            }}
            onMouseEnter={() => setHoveredLevel(level)}
            onMouseLeave={() => setHoveredLevel(null)}
            onClick={() => {
              if (isClickable) onLevelClick(level);
            }}
          >
            {/* The base island marker circle */}
            <div className="island-marker">
              <img src={levelImages[level]} alt={`Level ${level}`} className="island-photo" />
              <div className="island-status-icon">
                {isCompleted && <CheckCircle size={16} />}
                {isCurrent && <Play size={16} fill="currentColor" />}
                {isLocked && <Lock size={16} />}
              </div>
            </div>

            {/* Hover Card — appears above the island */}
            <div className={`island-hover-card hover-card-level-${level} ${isHovered ? 'island-hover-card--visible' : ''}`}>
              <div className="island-hover-card__img-wrap">
                <img src={hoverImages[level]} alt={levelNames[level]} />
                <div className={`island-hover-card__badge ${isCompleted ? 'badge-done' : isCurrent ? 'badge-current' : 'badge-locked'}`}>
                  {isCompleted ? '✓ Done' : isCurrent ? '▶ Active' : '🔒 Locked'}
                </div>
              </div>
              <div className="island-hover-card__body">
                <p className="island-hover-card__sub">Level {level}</p>
                <h3 className="island-hover-card__title">{levelNames[level]}</h3>
                <p className="island-hover-card__desc">{levelDesc[level]}</p>
                <div className="island-hover-card__pts">
                  <span className="pts-icon">⭐</span>
                  <span>{isCompleted && earnedPoints !== undefined ? `+${earnedPoints} pts earned` : `${displayPoints} pts`}</span>
                </div>
                {isCompleted && (
                  <p className="island-hover-card__done-msg">Already conquered — no going back!</p>
                )}
                {isCurrent && (
                  <p className="island-hover-card__action-msg">Click to start your challenge!</p>
                )}
                {isLocked && (
                  <p className="island-hover-card__locked-msg">Complete previous levels first.</p>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Floating Ship Avatar */}
      {avatarPosition && (
        <div
          className={`quest-map-avatar ship-float ${justCompletedLevel ? 'animating-ship' : ''}`}
          style={{ top: avatarPosition.top, left: avatarPosition.left }}
        >
          <img src="/going-merry.webp" alt="Player Ship" className="avatar-img" />
          <div className="avatar-shadow" />
        </div>
      )}
    </div>
  );
}
