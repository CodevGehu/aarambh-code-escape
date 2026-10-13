import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../lib/api';

// Do not mount organizer pages (or their controls) until the server confirms
// a live organizer session. A participant token cannot grant organizer access.
export default function ProtectedAdminRoute({ children }) {
  const [verified, setVerified] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setVerified(false); setDenied(false); setError('');
    if (!sessionStorage.getItem('adminToken')) {
      setDenied(true);
      return () => { active = false; };
    }
    const clear = () => { if (active) { setVerified(false); setDenied(true); } };
    window.addEventListener('admin-session-ended', clear);
    api.get('/admin/verify').then(() => {
      if (active) setVerified(true);
    }).catch(failure => {
      if (!active) return;
      if (failure.response?.status === 401) {
        sessionStorage.removeItem('adminToken'); setDenied(true);
      } else setError('Unable to verify this session. Check your connection and retry.');
    });
    return () => { active = false; window.removeEventListener('admin-session-ended', clear); };
  }, [retry]);
  if (denied) return <Navigate to={sessionStorage.getItem('teamToken') ? '/dashboard' : '/admin'} replace />;
  if (!verified) return <main className="container page-content"><p role="status">{error || 'Checking access…'}</p>{error && <button className="btn" onClick={() => setRetry(value => value + 1)}>Retry</button>}</main>;
  return children;
}
