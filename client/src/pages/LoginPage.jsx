import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, Navigate } from 'react-router-dom';
import { Code2, ArrowRight } from 'lucide-react';
export default function LoginPage() {
  const { user, team, loading, error, signIn } = useAuth();
  const [email, setEmail] = useState(''), [accessCode, setAccessCode] = useState('');
  if (!loading && user && team) return <Navigate to="/dashboard" replace />;
  return <main className="login-layout">
    <section className="login-intro"><span className="badge badge-lime" style={{ width:'fit-content' }}>Aarambh 4.0</span><h1>Code.<br />Crack.<br />Escape.</h1><p>Five rooms. Two hours. Put your team's curiosity to the test.</p><div className="login-terminal" style={{ marginTop:40 }} aria-hidden="true"><Code2 size={30} /> &gt; escape_room</div></section>
    <section className="login-form-area"><div className="login-card">
      <h2>Your team starts here.</h2><p className="muted">Sign in on your team's device with the access code from your paid Aarambh registration.</p>
      {error && <p role="alert" className="notice notice-error" style={{ marginTop:18 }}>{error}</p>}
      <form onSubmit={e => { e.preventDefault(); signIn(email, accessCode); }}>
        <label htmlFor="leader-email">Registered leader email<input id="leader-email" className="input" type="email" autoComplete="username" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} disabled={loading} /></label>
        <label htmlFor="access-code">Team access code<input id="access-code" className="input" type="password" autoComplete="current-password" required maxLength={128} value={accessCode} onChange={e => setAccessCode(e.target.value)} disabled={loading} /></label>
        <button className="btn btn-primary" id="btn-team-login" disabled={loading}>{loading ? 'Signing in…' : <>Enter escape room <ArrowRight size={18} /></>}</button>
      </form>
      <p className="muted small" style={{ marginTop:22 }}>One active session per team. Signing in elsewhere ends the previous session. Find your code on your Aarambh registration after payment is confirmed. Need help? Ask an organizer.</p>
      <p className="small" style={{ marginTop:20 }}><Link to="/admin">Organizer sign in</Link></p>
    </div></section>
  </main>;
}
