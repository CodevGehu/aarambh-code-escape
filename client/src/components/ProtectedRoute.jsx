import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, team, loading, error } = useAuth();

  if (loading) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh' }}>
        <div className="loading-spinner animate-spin" style={{
          width: '48px',
          height: '48px',
          border: '3px solid rgba(212, 168, 67, 0.2)',
          borderTopColor: 'var(--color-gold)',
          borderRadius: '50%'
        }} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  // User is authenticated but not a registered team leader
  if (error && !team) {
    return <Navigate to="/" replace />;
  }

  if (!team) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh' }}>
        <div className="loading-spinner animate-spin" style={{
          width: '48px',
          height: '48px',
          border: '3px solid rgba(212, 168, 67, 0.2)',
          borderTopColor: 'var(--color-gold)',
          borderRadius: '50%'
        }} />
      </div>
    );
  }

  return children;
}
