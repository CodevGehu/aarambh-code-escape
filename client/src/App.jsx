import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import QuestionPage from './pages/QuestionPage';
import Leaderboard from './pages/Leaderboard';
import AdminPage from './pages/AdminPage';
import PuzzleLabPage from './pages/PuzzleLabPage';
import AnswerBookletPage from './pages/AnswerBookletPage';
import ErrorPage from './pages/ErrorPage';
import EventAnnouncement from './components/EventAnnouncement';
import AppErrorBoundary from './components/AppErrorBoundary';
import './styles/EventMessages.css';

export default function App() {
  return (
    <AppErrorBoundary><BrowserRouter>
      <AuthProvider>
        <EventAnnouncement />
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/question/:level"
            element={
              <ProtectedRoute>
                <QuestionPage />
              </ProtectedRoute>
            }
          />
          {/* Leaderboard is intentionally PUBLIC — no ProtectedRoute.
              The server API has no auth on GET /api/leaderboard either.
              This allows display screens at the event to show live rankings
              without needing a team login. The Navbar handles null team safely
              via optional chaining (team?.team_name). */}
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/puzzles" element={<PuzzleLabPage />} />
          <Route path="/admin/answer-booklet" element={<AnswerBookletPage />} />
          <Route path="*" element={<ErrorPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter></AppErrorBoundary>
  );
}
