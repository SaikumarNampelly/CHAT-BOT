import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useChatStore } from '../store/chatStore';
import { useThemeStore } from '../store/themeStore';
import EmojiPicker from 'emoji-picker-react';

const GENDER_OPTIONS = [
  { 
    id: 'female', 
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="9" r="4" />
        <path d="M12 13v8M9 17h6" />
      </svg>
    ), 
    label: 'Female' 
  },
  { 
    id: 'male',   
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="9" r="4" />
        <path d="M12 13v8M12 17h-2M14 17h-2" />
      </svg>
    ), 
    label: 'Male'   
  },
  { 
    id: 'other',  
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 12h8" />
      </svg>
    ), 
    label: 'Other'  
  },
];

export default function CompanionSetup() {
  const navigate = useNavigate();
  const { setCompanions, setActiveCompanion } = useChatStore();
  const { theme, toggleTheme } = useThemeStore();

  const [companionName, setCompanionName] = useState('');
  const [userGender, setUserGender]       = useState('male');
  const [scenario, setScenario]           = useState('');
  const [error, setError]                 = useState('');
  const [loading, setLoading]             = useState(false);
  const [emoji, setEmoji]                 = useState('🫂');
  const [showPicker, setShowPicker]       = useState(false);

  const handleCreate = async () => {
    if (!companionName.trim()) {
      setError('Please enter a name for your companion.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { data: companion } = await api.post('/companions', {
        companion_name: `${emoji}|${gender}|${userGender}|${companionName.trim()}`,
        role: 'friend',
        scenario: scenario.trim(),
        language: 'tanglish',
      });
      const { data: list } = await api.get('/companions');
      setCompanions(list);
      setActiveCompanion(companion);
      navigate('/chat');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create companion.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 overflow-y-auto py-12">
      {/* Top right theme toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label="Toggle theme"
        title="Toggle theme"
        className="fixed top-5 right-5 z-20 p-2.5 rounded-full border border-slate-200 dark:border-teal-500/20 bg-white/70 dark:bg-[#090f0e]/80 text-slate-700 dark:text-teal-400 backdrop-blur-md shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer"
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
      <div className="w-full max-w-lg my-auto rounded-3xl border border-slate-200/90 dark:border-teal-500/20 bg-white/85 dark:bg-[#0c1413]/85 backdrop-blur-xl p-6 sm:p-9 shadow-2xl shadow-slate-300/40 dark:shadow-black/50 transition-all">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-500/30 flex items-center justify-center text-lg">
              🫂
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Your Soul
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Start your journey and customize your AI companion
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-sm flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Profile Icon selector */}
        <div className="flex flex-col items-center mb-6">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Profile Icon
          </span>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowPicker(!showPicker)}
              title="Choose Profile Emoji"
              className="w-20 h-20 rounded-full border-2 border-dashed border-teal-500 dark:border-teal-400 bg-slate-100 dark:bg-[#090f0e] flex items-center justify-center text-4xl shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              {emoji}
            </button>
            {showPicker && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 z-50 mt-3 shadow-2xl rounded-2xl overflow-hidden">
                <EmojiPicker
                  onEmojiClick={(e) => {
                    setEmoji(e.emoji);
                    setShowPicker(false);
                  }}
                  theme={theme === 'dark' ? 'dark' : 'light'}
                />
              </div>
            )}
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            Click to change emoji
          </span>
        </div>

        {/* Companion Name */}
        <div className="mb-5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5" htmlFor="companion-name-input">
            What's their name?
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3.5 text-slate-400 dark:text-teal-500/60 pointer-events-none">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </span>
            <input
              id="companion-name-input"
              type="text"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-teal-500/20 bg-slate-50/70 dark:bg-[#060a0a]/70 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 dark:focus:border-teal-400 transition-all"
              placeholder="e.g. Priya, Arjun, Meera..."
              value={companionName}
              onChange={(e) => setCompanionName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
        </div>

        {/* Companion Gender */}
        <div className="mb-5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
            Who are they? (Companion's Gender)
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {GENDER_OPTIONS.map((g) => {
              const active = gender === g.id;
              return (
                <button
                  key={g.id}
                  id={`gender-${g.id}`}
                  type="button"
                  onClick={() => setGender(g.id)}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? 'border-teal-500 bg-teal-500/10 text-teal-600 dark:text-teal-300 ring-2 ring-teal-500/30 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090f0e] text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {g.icon}
                  <span>{g.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* User Gender */}
        <div className="mb-5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
            Your Gender
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {GENDER_OPTIONS.map((g) => {
              const active = userGender === g.id;
              return (
                <button
                  key={g.id}
                  id={`user-gender-${g.id}`}
                  type="button"
                  onClick={() => setUserGender(g.id)}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? 'border-teal-500 bg-teal-500/10 text-teal-600 dark:text-teal-300 ring-2 ring-teal-500/30 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090f0e] text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {g.icon}
                  <span>{g.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Context / Scenario */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Any context?
            </label>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 lowercase">(optional)</span>
          </div>
          <textarea
            className="w-full p-3 rounded-xl border border-slate-200 dark:border-teal-500/20 bg-slate-50/70 dark:bg-[#060a0a]/70 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 dark:focus:border-teal-400 transition-all resize-none"
            rows={3}
            placeholder={"Tell them a bit about your situation...\ne.g. I'm a student dealing with exams. I need someone kind to talk with."}
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
          />
        </div>

        {/* Submit */}
        <button
          id="create-companion-btn"
          type="button"
          onClick={handleCreate}
          disabled={loading}
          className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 active:scale-[0.99] text-white font-medium text-sm tracking-wide shadow-lg shadow-teal-600/25 hover:shadow-teal-500/35 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Setting up...</span>
            </>
          ) : (
            `Start chatting with ${companionName || 'your companion'} →`
          )}
        </button>
      </div>
    </div>
  );
}
