import { useEffect, useState } from 'react';
import { Check, Lock, Play, SkipForward, Code2 } from 'lucide-react';
import '../styles/QuestMap.css';
const roomNames = ['Entry point', 'Find the pattern', 'Trace the clue', 'Break the code', 'Final escape'];
export default function QuestMap({ currentLevel = 0, outcomes = [], active = false, onLevelClick, justCompletedLevel }) {
  const target = Math.max(1, Math.min(5, currentLevel));
  const [marker, setMarker] = useState(justCompletedLevel || target);
  useEffect(() => {
    const id = setTimeout(() => setMarker(target), justCompletedLevel ? 140 : 0);
    return () => clearTimeout(id);
  }, [target, justCompletedLevel]);
  const states = [1,2,3,4,5].map(level => outcomes.find(o => o.level === level)?.status || (level < currentLevel ? 'solved' : level === target && currentLevel <= 5 ? 'current' : 'locked'));
  return <section className="checkpoint-panel" aria-label="Your five-round path">
    <div className="terminal-label"><span className="terminal-dots" aria-hidden="true"><i /><i /><i /></span>team_progress.exe <span style={{ marginLeft:'auto' }}>{Math.min(5, Math.max(0, currentLevel - 1))}/5 rounds</span></div>
    <div className="checkpoint-stage">
      <div className="checkpoint-track" aria-hidden="true"><div className="checkpoint-marker" style={{ left:`${(marker - 1) * 25}%` }}><Code2 size={22} /></div></div>
      <div className="room-grid">{states.map((state, index) => {
        const level = index + 1, done = state === 'solved' || state === 'skipped';
        const Icon = state === 'solved' ? Check : state === 'skipped' ? SkipForward : state === 'current' ? Play : Lock;
        const outcome = outcomes.find(o => o.level === level);
        return <button key={level} className={`room room-${state}`} disabled={state !== 'current' || !active} onClick={() => onLevelClick(level)} aria-current={state === 'current' ? 'step' : undefined} aria-label={`Round ${level}, ${state}${outcome ? `, ${outcome.points} points` : ''}`}>
          <span className="room-number">{String(level).padStart(2,'0')}</span><Icon size={26} /><strong>{roomNames[index]}</strong><span className="room-status">{done ? `${state === 'solved' ? 'Solved' : 'Skipped'} ${outcome?.points >= 0 ? '+' : ''}${outcome?.points ?? ''}` : state === 'current' ? active ? 'Enter round' : 'Your next room' : 'Locked'}</span>
        </button>;
      })}</div>
    </div>
    <div className="checkpoint-legend"><span><i style={{ background:'var(--lime)' }} /> Solved</span><span><i style={{ background:'var(--pink)' }} /> Skipped</span><span><i style={{ background:'var(--purple)' }} /> Current</span><span><i style={{ background:'#e5e1db' }} /> Locked</span></div>
  </section>;
}
