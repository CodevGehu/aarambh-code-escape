import { createContext, useContext, useEffect, useState } from 'react';
import api from '../lib/api';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const acceptTeam = team => {
    setTeam(team);
    setUser({ id: team._id, email: team.email });
  };
  useEffect(() => {
    let active = true;
    const onSessionEnded = event => {
      setUser(null);
      setTeam(null);
      setError(event.detail || 'Your team session has ended. Please sign in again.');
    };
    window.addEventListener('team-session-ended', onSessionEnded);
    if (sessionStorage.getItem('teamToken')) {
      api.get('/auth/me').then(res => { if (active) acceptTeam(res.data.team); })
        .catch(err => { if (active) setError(err.response?.data?.error || 'Unable to restore your session. Please try signing in again.'); })
        .finally(() => { if (active) setLoading(false); });
    } else setLoading(false);
    return () => {
      active = false;
      window.removeEventListener('team-session-ended', onSessionEnded);
    };
  }, []);
  const signIn = async (email, accessCode) => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, accessCode });
      sessionStorage.setItem('teamToken', res.data.token);
      acceptTeam(res.data.team);
    } catch (err) {
      setError(err.response?.data?.error || 'Sign-in failed. Please try again.');
    } finally { setLoading(false); }
  };
  const signOut = async () => {
    try {
      await api.post('/auth/logout');
      sessionStorage.removeItem('teamToken');
      setUser(null);
      setTeam(null);
      setError(null);
    } catch (err) {
      if (err.response?.status !== 401) setError(err.response?.data?.error || 'Unable to sign out. Please try again.');
    }
  };
  const refreshTeam = async () => {
    try { const res = await api.get('/auth/me'); acceptTeam(res.data.team); }
    catch (err) { if (err.response?.status !== 401) setError(err.response?.data?.error || 'Unable to refresh your team.'); }
  };
  return <AuthContext.Provider value={{ user, team, loading, error, signIn, signOut, refreshTeam, setError }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
