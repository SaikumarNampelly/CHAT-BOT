import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import Register from './pages/Register';
import CompanionSetup from './pages/CompanionSetup';
import Chat from './pages/Chat';

function PrivateRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return !isAuthenticated ? children : <Navigate to="/chat" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="relative min-h-screen w-full bg-slate-50 text-slate-900 dark:bg-[#060a0a] dark:text-slate-100 transition-colors duration-300 overflow-hidden font-sans">
        <div className="fixed inset-0 pointer-events-none ambient-pattern z-0 opacity-80"></div>
        <div className="relative z-10 w-full h-screen">
          <Routes>
            <Route path="/" element={<Navigate to="/chat" replace />} />
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/setup" element={<PrivateRoute><CompanionSetup /></PrivateRoute>} />
            <Route path="/chat" element={<PrivateRoute><Chat /></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/chat" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
