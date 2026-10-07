import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import Register from './pages/Register';
import CompanionSetup from './pages/CompanionSetup';
import Chat from './pages/Chat';
import TokenCascadeOverlay from './components/TokenCascadeOverlay';

function PrivateRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return !isAuthenticated ? children : <Navigate to="/chat" replace />;
}

function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}
      className="w-full flex-1 flex flex-col min-h-full"
    >
      {children}
    </motion.div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <PageTransition>
                <Login />
              </PageTransition>
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <PageTransition>
                <Register />
              </PageTransition>
            </PublicRoute>
          }
        />
        <Route
          path="/setup"
          element={
            <PrivateRoute>
              <PageTransition>
                <CompanionSetup />
              </PageTransition>
            </PrivateRoute>
          }
        />
        <Route
          path="/chat"
          element={
            <PrivateRoute>
              <PageTransition>
                <Chat />
              </PageTransition>
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="relative min-h-screen min-h-dvh w-full bg-slate-50 text-slate-900 dark:bg-[#060a0a] dark:text-slate-100 font-sans flex flex-col">
        <TokenCascadeOverlay />
        {/* Modern Portal Background Grid */}
        <div className="portal-grid" aria-hidden="true">
          <div className="portal-grid-glow"></div>
          <div className="portal-grid-lines"></div>
          <div className="portal-grid-dots"></div>
        </div>
        <div className="relative z-10 w-full flex-1 flex flex-col min-h-screen min-h-dvh">
          <AnimatedRoutes />
        </div>
      </div>
    </BrowserRouter>
  );
}
