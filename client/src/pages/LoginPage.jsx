import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import GlassCard from '../components/GlassCard';

export default function LoginPage() {
  const { user, team, loading, error, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  if (!loading && user && team) return <Navigate to="/dashboard" replace />;
  const inputStyle = { width: '100%', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gold)', background: 'rgba(10,22,40,0.85)', color: 'var(--color-cream)', marginTop: '8px' };
  return (
    <div className="page" id="login-page">
      <div className="app-background" /><div className="app-overlay" />
      <div className="flex-center" style={{ minHeight: '100vh', padding: 'var(--space-lg)' }}>
        <GlassCard className="animate-scale-in" style={{ maxWidth: '460px', width: '100%', textAlign: 'center', padding: 'var(--space-2xl)' }} id="login-card">
          <KeyRound size={40} style={{ marginBottom: 'var(--space-lg)', color: 'var(--color-gold)' }} />
          <h1 style={{ marginBottom: 'var(--space-sm)', fontSize: 'clamp(1.8rem, 4vw, 2.6rem)' }}>Aarambh Code Escape</h1>
          <p style={{ marginBottom: 'var(--space-xl)' }}>Your team. One device. Five rounds.</p>
          {error && <div role="alert" id="login-error" style={{ background: 'rgba(198,40,40,0.15)', padding: 'var(--space-md)', marginBottom: 'var(--space-lg)', color: '#ef9a9a' }}>{error}</div>}
          <form onSubmit={event => { event.preventDefault(); signIn(email, accessCode); }} style={{ textAlign: 'left' }}>
            <label htmlFor="leader-email">Registered leader email</label>
            <input id="leader-email" name="email" type="email" autoComplete="username" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={loading} style={inputStyle} />
            <label htmlFor="access-code" style={{ display: 'block', marginTop: 'var(--space-lg)' }}>Team access code</label>
            <input id="access-code" name="accessCode" type="password" autoComplete="current-password" required maxLength={128} value={accessCode} onChange={event => setAccessCode(event.target.value)} disabled={loading} style={inputStyle} />
            <button className="btn btn-primary" id="btn-team-login" type="submit" disabled={loading} style={{ width: '100%', marginTop: 'var(--space-lg)' }}>{loading ? 'Signing in...' : 'Enter escape room'}</button>
          </form>
          <p style={{ marginTop: 'var(--space-lg)', fontSize: '0.85rem', lineHeight: 1.6 }}>Use the private code supplied by the organizers.<br />Signing in on another device ends your previous session.</p>
        </GlassCard>
      </div>
    </div>
  );
}
