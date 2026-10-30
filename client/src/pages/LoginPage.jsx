import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Code2 } from 'lucide-react';
import api from '../lib/api';

let identityClient;
function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (!identityClient) identityClient = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    const timeout = setTimeout(() => fail(), 15000);
    function fail() {
      clearTimeout(timeout); script.remove();
      reject(new Error('Google sign-in could not load. Check your connection and retry.'));
    }
    script.onerror = fail;
    script.onload = () => {
      clearTimeout(timeout);
      if (window.google?.accounts?.id) resolve(window.google.accounts.id);
      else fail();
    };
    document.head.appendChild(script);
  }).catch(error => { identityClient = null; throw error; });
  return identityClient;
}

export default function LoginPage() {
  const { user, team, loading, error, signInGoogle } = useAuth();
  const button = useRef(null);
  const [state, setState] = useState('loading'), [message, setMessage] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setState('loading'); setMessage('');
    async function prepare() {
      try {
        const response = await api.get('/auth/config');
        if (!active) return;
        if (!response.data.google_client_id) {
          setMessage('Google sign-in is not ready yet. Please contact an organizer.');
          setState('unavailable'); return;
        }
        const identity = await loadGoogleIdentity();
        if (!active || !button.current) return;
        identity.initialize({ client_id: response.data.google_client_id, auto_select: false,
          callback: result => { if (active && result.credential) signInGoogle(result.credential); } });
        button.current.replaceChildren();
        identity.renderButton(button.current, { theme: 'outline', size: 'large', text: 'signin_with',
          shape: 'rectangular', width: Math.min(360, button.current.clientWidth || 300) });
        setState('ready');
      } catch (failure) {
        if (active) {
          setMessage(failure.response?.data?.error || failure.message || 'Unable to load sign-in. Please retry.');
          setState('error');
        }
      }
    }
    prepare();
    return () => { active = false; };
  }, [retry, signInGoogle]);
  if (!loading && user && team) return <Navigate to="/dashboard" replace />;
  return <main className="login-layout">
    <section className="login-intro"><span className="badge badge-lime" style={{ width: 'fit-content' }}>Aarambh 4.0</span><h1>Code.<br />Crack.<br />Escape.</h1><p>Five rooms. Two hours. Put your team's curiosity to the test.</p><div className="login-terminal" style={{ marginTop: 40 }} aria-hidden="true"><Code2 size={30} /> &gt; escape_room</div></section>
    <section className="login-form-area"><div className="login-card">
      <h2>Your team starts here.</h2>
      <p className="muted">Sign in with the Google account listed in your Code Escape Room registration.</p>
      {error && <p role="alert" className="notice notice-error" style={{ marginTop: 18 }}>{error}</p>}
      <div className="google-login" aria-busy={loading || state === 'loading'}>
        <div ref={button} inert={loading || state !== 'ready' ? true : undefined} />
        {(loading || state === 'loading') && <p role="status">{loading ? 'Signing in…' : 'Loading Google sign-in…'}</p>}
        {message && <p role="alert" className="notice notice-error">{message}</p>}
        {(state === 'error' || state === 'unavailable') && <button className="btn" onClick={() => setRetry(value => value + 1)}>Retry sign-in</button>}
      </div>
      <p className="muted small">Every registered team member can sign in on their own device. Your team shares one timer, round progress and score. Work together and coordinate submissions.</p>
      <p className="muted small" style={{ marginTop: 14 }}>Account not recognized? Check that you selected your registered Google email, then ask an organizer.</p>
    </div></section>
  </main>;
}
