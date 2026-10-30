import { useCallback, useEffect, useRef, useState } from 'react';
import { milestoneAnnouncements } from './leaderboardAnnouncements';
import { createCelebrationKit } from './celebrationSounds';

const STORAGE_KEY = 'code-escape-milestone-sound';
const BIGGEST = ['finish', 'lead', 'first', 'cleared'];
const AudioContextClass = () => typeof window === 'undefined' ? null : window.AudioContext || window.webkitAudioContext || null;
const readPreference = () => { try { return localStorage.getItem(STORAGE_KEY) === 'on'; } catch { return false; } };
const savePreference = on => { try { localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off'); } catch { /* Sound still works for this visit. */ } };

// Diffs each new set of standings, queues on-screen shout-outs and, when the
// viewer has switched sound on, plays a celebration sized to the moment.
export function useMilestones(rows) {
  const supported = Boolean(AudioContextClass());
  const [enabled, setEnabled] = useState(() => supported && readPreference());
  const [blocked, setBlocked] = useState(false);
  const [queue, setQueue] = useState([]);
  const previous = useRef(null), audio = useRef(null), kit = useRef(null), enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const unlock = useCallback(() => {
    try {
      const Context = AudioContextClass();
      if (Context && !audio.current) { audio.current = new Context(); kit.current = createCelebrationKit(audio.current); }
      audio.current?.resume?.();
      setBlocked(false);
    } catch { /* Shout-outs still appear without sound. */ }
  }, []);

  const play = useCallback(async kind => {
    // resume() stays pending until the page has had a click, so never wait long on it.
    try { if (audio.current?.state === 'suspended') await Promise.race([audio.current.resume(), new Promise(done => setTimeout(done, 300))]); } catch { /* Checked below. */ }
    if (audio.current?.state !== 'running') { setBlocked(true); return; }
    try { kit.current?.play(kind); } catch { /* Sound is optional. */ }
  }, []);

  useEffect(() => {
    if (!rows) return;
    const items = milestoneAnnouncements(previous.current, rows);
    previous.current = rows;
    if (!items.length) return;
    setQueue(current => [...current, ...items]);
    // One celebration per update, sized for the biggest moment in it. Skips stay silent.
    const celebrated = items.filter(item => item.speech);
    if (enabledRef.current && celebrated.length) play(BIGGEST.find(kind => celebrated.some(item => item.kind === kind)) || 'cleared');
  }, [rows, play]);

  // Browsers allow audio only after a click; a remembered "on" waits for the first one.
  useEffect(() => {
    if (!enabled) return;
    unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, [enabled, unlock]);

  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    const timeout = setTimeout(() => setQueue(items => items.slice(1)), 5000);
    return () => clearTimeout(timeout);
  }, [current?.id]);

  const toggle = useCallback(() => {
    const next = !enabledRef.current;
    setEnabled(next); savePreference(next);
    if (next) { unlock(); play('cleared'); }
  }, [unlock, play]);

  // Organizer speaker check: cycles through the four celebrations.
  const sample = useRef(0);
  const preview = useCallback(() => {
    unlock();
    const kind = BIGGEST.slice().reverse()[sample.current++ % 4];
    play(kind);
    setQueue(items => [...items, { id: `preview:${Date.now()}`, team: 'Sound check', kind,
      text: { cleared: '· round cleared', first: '· first team out of a round', lead: '· new leader', finish: '· escaped all five rooms' }[kind] }]);
  }, [unlock, play]);

  return { announcement: current, voice: { supported, enabled, blocked, toggle, preview } };
}
