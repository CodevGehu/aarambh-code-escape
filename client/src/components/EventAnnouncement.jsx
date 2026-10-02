import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Flag, Rocket } from 'lucide-react';
import { useGameClock } from '../lib/gameClock';
import { getEventNotice, noticeWasSeen, rememberNotice } from '../lib/eventNotice';

export default function EventAnnouncement() {
  const location = useLocation();
  const navigate = useNavigate();
  const isParticipantPage = location.pathname !== '/admin';
  // One shared poll survives navigation between rooms, the dashboard and rankings.
  const { team, event, ended } = useGameClock({ poll: isParticipantPage });
  const notice = getEventNotice(team, event, ended);
  const [acknowledged, setAcknowledged] = useState(() => new Set());
  const dialog = useRef(null);
  const visible = Boolean(isParticipantPage && notice && !acknowledged.has(notice.key)
    && !noticeWasSeen(notice.key, window.sessionStorage));

  useEffect(() => {
    if (!visible) return;
    const previous = document.activeElement;
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); if (previous?.isConnected) previous.focus(); };
  }, [visible, notice?.key]);

  function acknowledge() {
    if (!notice) return;
    rememberNotice(notice.key, window.sessionStorage);
    setAcknowledged(previous => new Set(previous).add(notice.key));
  }

  if (!visible) return null;
  const isEnded = notice.phase === 'ended';
  return <dialog ref={dialog} className={`event-announcement ${isEnded ? 'event-announcement-ended' : ''}`}
    aria-labelledby="event-announcement-title" aria-describedby="event-announcement-description"
    onCancel={e => { e.preventDefault(); acknowledge(); }}>
    <div className="event-announcement-symbol" aria-hidden="true">{isEnded ? <Flag size={38} /> : <Rocket size={38} />}</div>
    <p className="event-announcement-team">{team.team_name}</p>
    <h2 id="event-announcement-title">{isEnded ? 'The event has ended.' : 'Code Escape is live!'}</h2>
    <p id="event-announcement-description">{isEnded
      ? 'Answer submissions are closed. Your recorded progress and score are saved. Thank you for playing Aarambh Code Escape.'
      : 'The shared event timer is running. Your team can enter its current room now. Solve together, and carry your unused round time into the next room.'}</p>
    <p className="event-announcement-note">{isEnded
      ? 'Check your round outcomes and the latest rankings.'
      : 'The timer keeps running while this message is open.'}</p>
    <div className="row">
      <button className="btn btn-primary" autoFocus onClick={() => { acknowledge(); navigate('/dashboard'); }}>{isEnded ? 'View team results' : 'Let’s escape'}</button>
      <button className="btn btn-ghost" onClick={acknowledge}>{isEnded ? 'Stay on this page' : 'Keep this page open'}</button>
    </div>
  </dialog>;
}
