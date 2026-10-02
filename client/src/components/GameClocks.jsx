import { Clock, Timer, Plus } from 'lucide-react';
import { formatClock } from '../lib/gameClock';
export default function GameClocks({ game }) {
  const { event, round, eventRemaining, roundRemaining, overtime, expired, ended } = game;
  return <div className="clock-strip" aria-label="Event and round timing">
    <div className="clock-tile"><span className="clock-label"><Clock size={15} /> Event remaining</span><strong className="clock-value">{event?.status === 'not_started' ? 'Not started' : ended ? '00:00' : eventRemaining === null ? 'Syncing…' : formatClock(eventRemaining)}</strong></div>
    <div className={`clock-tile ${expired ? 'clock-expired' : ''}`}><span className="clock-label"><Timer size={15} /> {expired ? 'Round overtime' : 'Round remaining'}</span><strong className="clock-value">{ended ? 'Closed' : !round?.deadline ? '—' : expired ? `+${formatClock(overtime)}` : formatClock(roundRemaining)}</strong></div>
    <div className="clock-tile"><span className="clock-label"><Plus size={15} /> Saved time added to this round</span><strong className="clock-value">{round ? formatClock(round.carry_ms) : '—'}</strong></div>
  </div>;
}
