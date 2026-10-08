import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useThemeStore } from '../store/themeStore';
import Toast from '../components/Toast';

export default function Register() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useThemeStore();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/register', form);
      navigate('/login', { state: { success: 'Registration successful! Please sign in to continue.' } });
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-start p-4 sm:p-6 py-8 sm:py-12">
      {/* Top Middle Floating Error Toast */}
      <Toast message={error} type="error" onClose={() => setError('')} duration={5000} />

      {/* Top right theme toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label="Toggle theme"
        title="Toggle theme"
        className="fixed top-5 right-5 z-20 p-2.5 rounded-full border border-[#E7E5F0] dark:border-[#262247] bg-white/80 dark:bg-[#141228]/80 text-[#68657D] dark:text-[#9E9AB3] hover:text-[#643EF3] dark:hover:text-[#8D6BFF] backdrop-blur-md shadow-xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
      >
        {theme === 'dark' ? (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
          </svg>
        )}
      </button>

      {/* Main card */}
      <div className="w-full max-w-md my-auto rounded-3xl border border-[#E7E5F0] dark:border-[#262247] bg-white/95 dark:bg-[#141228]/95 backdrop-blur-xl p-8 sm:p-10 shadow-xl shadow-[#171533]/5 dark:shadow-black/60 transition-all">
        {/* Brand header */}
        <div className="flex flex-col items-center text-center mb-7">
          <div className="relative mb-3.5 group">
            <div className="absolute -inset-1.5 rounded-2xl brand-gradient opacity-35 blur-md group-hover:opacity-50 transition-opacity"></div>
            <img
              src="/talkmate-icon.png"
              alt="TalkMate"
              className="relative w-16 h-16 rounded-2xl object-cover shadow-md border border-white/20"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#171533] dark:text-[#F4F3FA]">
            Talk<span className="text-[#643EF3] dark:text-[#8D6BFF]">Mate</span>
          </h1>
          <p className="text-xs font-semibold text-[#68657D] dark:text-[#9E9AB3] mt-1 uppercase tracking-wider">
            Feel the connection
          </p>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-[#171533] dark:text-[#F4F3FA]">Create your account</h2>
          <p className="text-sm text-[#68657D] dark:text-[#9E9AB3] mt-1">Join and meet your companion</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#171533] dark:text-[#F4F3FA] mb-1.5" htmlFor="name">
              Your Name
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-[#68657D] dark:text-[#9E9AB3] pointer-events-none">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <input
                id="name"
                type="text"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E7E5F0] dark:border-[#262247] bg-[#F8F7FC] dark:bg-[#0C0A1B] text-[#171533] dark:text-[#F4F3FA] placeholder-[#68657D]/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#643EF3]/20 focus:border-[#643EF3] transition-all"
                placeholder="e.g. Sai Kumar"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#171533] dark:text-[#F4F3FA] mb-1.5" htmlFor="reg-email">
              Email
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-[#68657D] dark:text-[#9E9AB3] pointer-events-none">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </span>
              <input
                id="reg-email"
                type="email"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E7E5F0] dark:border-[#262247] bg-[#F8F7FC] dark:bg-[#0C0A1B] text-[#171533] dark:text-[#F4F3FA] placeholder-[#68657D]/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#643EF3]/20 focus:border-[#643EF3] transition-all"
                placeholder="you@email.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#171533] dark:text-[#F4F3FA] mb-1.5" htmlFor="reg-password">
              Password
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-[#68657D] dark:text-[#9E9AB3] pointer-events-none">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-[#E7E5F0] dark:border-[#262247] bg-[#F8F7FC] dark:bg-[#0C0A1B] text-[#171533] dark:text-[#F4F3FA] placeholder-[#68657D]/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#643EF3]/20 focus:border-[#643EF3] transition-all"
                placeholder="Minimum 6 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
              />
              <button
                type="button"
                className="absolute right-3 p-1 text-[#68657D] hover:text-[#171533] dark:text-[#9E9AB3] dark:hover:text-[#F4F3FA] transition-colors cursor-pointer"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                    <line x1="2" y1="2" x2="22" y2="22" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            id="register-btn"
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-[#643EF3] hover:bg-[#3A1ABB] active:bg-[#3A1ABB] text-white font-semibold text-sm tracking-wide shadow-md shadow-[#643EF3]/25 hover:shadow-lg hover:shadow-[#643EF3]/35 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Creating account...</span>
              </>
            ) : (
              'Create Account →'
            )}
          </button>
        </form>

        <p className="text-center text-xs sm:text-sm text-[#68657D] dark:text-[#9E9AB3] mt-6">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-[#643EF3] dark:text-[#8D6BFF] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
