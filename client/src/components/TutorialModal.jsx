import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
export default function TutorialModal({ onClose }) {
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    const handleKey = event => {
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key === 'Tab') { event.preventDefault(); closeRef.current?.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); previous?.focus(); };
  }, []);
  return <div className="modal-backdrop"><div className="tutorial-card" role="dialog" aria-modal="true" aria-labelledby="rules-title">
    <div className="row between"><h2 id="rules-title">How to escape</h2><button className="btn btn-ghost" ref={closeRef} onClick={onClose} aria-label="Close rules"><X size={20} /></button></div>
    <ol>
      <li><strong>One team, shared progress.</strong>Every registered member can sign in with their Google account. Your timer, rounds and score are shared. Browsing is allowed; coordinate before submitting.</li>
      <li><strong>Everyone starts together.</strong>You have two hours from the organizer's shared start. Finish a round to move immediately. All submissions close when the event ends.</li>
      <li><strong>Save time for the next room.</strong>Finish within your round allowance for full points. Unused time carries forward.</li>
      <li><strong>After your time cap, choose.</strong>Continue with a decreasing reward, or skip for the displayed penalty. Scores can go below zero.</li>
      <li><strong>Respect other teams.</strong>No disturbance, nuisance, bad behaviour or peeping at another team's screen or solution. Teams found doing this will be disqualified without a refund.</li>
    </ol>
    <p className="muted small">Use the live reward and penalty shown for your current round. If a connection fails, reconnect on the same device; your timer keeps running.</p>
  </div></div>;
}
