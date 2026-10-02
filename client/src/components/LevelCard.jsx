export default function LevelCard({ level, unlocked, completed, onClick }) {
  return <button className="panel" onClick={onClick} disabled={!unlocked || completed}>Round {level}: {completed ? 'Solved' : unlocked ? 'Open' : 'Locked'}</button>;
}
