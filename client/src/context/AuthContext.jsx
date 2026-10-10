import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../lib/api';
import { clearStorageClues } from '../lib/roundPuzzles';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [team, setTeam] = useState(null);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const acceptSnapshot = useCallback(snapshot => {
    if (snapshot.team) {
      setTeam(snapshot.team);
      setUser({ id: snapshot.team._id, email: snapshot.team.email });
    }
    if (snapshot.event) setEvent(snapshot.event);
  }, []);
  useEffect(() => {
    let active = true;
    const onSessionEnded = event => {
      clearStorageClues();
      setUser(null); setTeam(null); setEvent(null);
      setError(event.detail || 'Your team session has ended. Please sign in again.');
    };
    window.addEventListener('team-session-ended', onSessionEnded);
    if (sessionStorage.getItem('teamToken')) {
      api.get('/auth/me').then(res => { if (active) acceptSnapshot(res.data); })
        .catch(err => { if (active) setError(err.response?.data?.error || 'Unable to restore your session. Please try signing in again.'); })
        .finally(() => { if (active) setLoading(false); });
    } else setLoading(false);
    return () => { active = false; window.removeEventListener('team-session-ended', onSessionEnded); };
  }, [acceptSnapshot]);
  const signIn = async (email, accessCode) => {
    setError(null); setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, accessCode });
      sessionStorage.setItem('teamToken', res.data.token);
      acceptSnapshot(res.data);
    } catch (err) { setError(err.response?.data?.error || 'Sign-in failed. Please try again.'); }
    finally { setLoading(false); }
  };
  const signOut = async () => {
    try {
      await api.post('/auth/logout'); sessionStorage.removeItem('teamToken');
      clearStorageClues();
      setUser(null); setTeam(null); setEvent(null); setError(null);
    } catch (err) {
      if (err.response?.status !== 401) setError(err.response?.data?.error || 'Unable to sign out. Please try again.');
    }
  };
  const refreshTeam = useCallback(async () => {
    try {
      const res = await api.get('/progress/state'); acceptSnapshot(res.data); setError(null); return res.data;
    } catch (err) {
      if (err.response?.status !== 401) setError(err.response?.data?.error || 'Connection interrupted. Your progress is saved; reconnecting…');
      return null;
    }
  }, [acceptSnapshot]);
  return <AuthContext.Provider value={{ user, team, event, loading, error, signIn, signOut, refreshTeam, acceptSnapshot, setError }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
