import { useMemo } from 'react';
import { Trophy, Volume2, VolumeX } from 'lucide-react';

export function VoiceToggle({ voice, className = 'btn btn-ghost' }) {
  if (!voice.supported) return null;
  return <button type="button" className={`${className} rankings-voice${voice.enabled ? ' is-on' : ''}`} aria-pressed={voice.enabled} onClick={voice.toggle}
    title={voice.enabled ? 'Milestone celebrations are playing' : 'Play a celebration sound for every milestone'}>
    {voice.enabled ? <Volume2 size={17} /> : <VolumeX size={17} />}{voice.enabled ? voice.blocked ? 'Tap to unmute' : 'Sound on' : 'Sound off'}
  </button>;
}

const CONFETTI_COLORS = ['#5b19d1', '#b8ff38', '#ff4ac0', '#111111', '#ffffff', '#ffd27a'];
const CONFETTI_COUNT = { cleared: 45, first: 90, lead: 90, finish: 140 };

// One burst of falling paper per milestone; skips get none.
function Confetti({ id, kind }) {
  const pieces = useMemo(() => Array.from({ length: CONFETTI_COUNT[kind] || 0 }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.6, duration: 2.2 + Math.random() * 1.6, size: 6 + Math.random() * 8,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], drift: Math.random() * 160 - 80, spin: Math.random() * 720 - 360, round: Math.random() < 0.3
  })), [id, kind]);
  if (!pieces.length) return null;
  return <div className="milestone-confetti" aria-hidden="true">{pieces.map((piece, i) => <i key={i} style={{ left: `${piece.left}%`, width: piece.size, height: piece.round ? piece.size : piece.size * 0.45,
    background: piece.color, borderRadius: piece.round ? '50%' : 1, animationDelay: `${piece.delay}s`, animationDuration: `${piece.duration}s`,
    '--drift': `${piece.drift}px`, '--spin': `${piece.spin}deg` }} />)}</div>;
}

export function MilestoneShoutout({ announcement }) {
  if (!announcement) return null;
  return <>
    <Confetti key={announcement.id} id={announcement.id} kind={announcement.kind} />
    <div className={`rankings-shoutout kind-${announcement.kind || 'advance'}`} role="status" aria-live="polite" aria-atomic="true">
      <Trophy size={30} aria-hidden="true" /><p><strong>{announcement.team}</strong> {announcement.text}</p>
    </div>
  </>;
}
