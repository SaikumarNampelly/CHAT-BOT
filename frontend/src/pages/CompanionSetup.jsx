import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useChatStore } from '../store/chatStore';
import { useThemeStore } from '../store/themeStore';
import AvatarSelector from '../components/AvatarSelector';
import Toast from '../components/Toast';

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
  const [gender, setGender]               = useState('female');
  const [scenario, setScenario]           = useState('');
  const [error, setError]                 = useState('');
  const [loading, setLoading]             = useState(false);
  const [emoji, setEmoji]                 = useState('🌸');

  const handleCreate = async () => {
    if (!companionName.trim()) {
      setError('Please enter a name for your companion.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { data: companion } = await api.post('/companions', {
        companion_name: `${emoji}|${gender}|other|${companionName.trim()}`,
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
      <div className="w-full max-w-lg my-auto rounded-3xl border border-[#E7E5F0] dark:border-[#262247] bg-white/95 dark:bg-[#141228]/95 backdrop-blur-xl p-6 sm:p-9 shadow-xl shadow-[#171533]/5 dark:shadow-black/60 transition-all">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-3 mb-2">
            <img
              src="/talkmate-icon.png"
              alt="TalkMate"
              className="w-10 h-10 rounded-xl object-cover shadow-sm border border-white/20"
            />
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#171533] dark:text-[#F4F3FA]">
              Talk<span className="text-[#643EF3] dark:text-[#8D6BFF]">Mate</span>
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#68657D] dark:text-[#9E9AB3]">
            Start your journey and customize your AI companion
          </p>
        </div>

        {/* Profile Avatar selector */}
        <div className="mb-6">
          <AvatarSelector
            value={emoji}
            onChange={setEmoji}
            companionName={companionName}
          />
        </div>

        {/* Companion Name */}
        <div className="mb-5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#171533] dark:text-[#F4F3FA] mb-1.5" htmlFor="companion-name-input">
            What's their name?
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3.5 text-[#68657D] dark:text-[#9E9AB3] pointer-events-none">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </span>
            <input
              id="companion-name-input"
              type="text"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E7E5F0] dark:border-[#262247] bg-[#F8F7FC] dark:bg-[#0C0A1B] text-[#171533] dark:text-[#F4F3FA] placeholder-[#68657D]/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#643EF3]/20 focus:border-[#643EF3] transition-all"
              placeholder="e.g. Maya, Alex, Sam..."
              value={companionName}
              onChange={(e) => setCompanionName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
        </div>

        {/* Companion Gender */}
        <div className="mb-5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#171533] dark:text-[#F4F3FA] mb-2">
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
                      ? 'border-[#643EF3] bg-[#F1EEFF] text-[#643EF3] dark:bg-[#643EF3]/20 dark:text-[#8D6BFF] ring-2 ring-[#643EF3]/30 shadow-xs'
                      : 'border-[#E7E5F0] dark:border-[#262247] bg-[#F8F7FC] dark:bg-[#0C0A1B] text-[#68657D] dark:text-[#9E9AB3] hover:border-[#643EF3]/40'
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#171533] dark:text-[#F4F3FA]">
              Any context?
            </label>
            <span className="text-[11px] text-[#68657D] dark:text-[#9E9AB3] lowercase">(optional)</span>
          </div>
          <textarea
            className="w-full p-3 rounded-xl border border-[#E7E5F0] dark:border-[#262247] bg-[#F8F7FC] dark:bg-[#0C0A1B] text-[#171533] dark:text-[#F4F3FA] placeholder-[#68657D]/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#643EF3]/20 focus:border-[#643EF3] transition-all resize-none"
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
          className="w-full py-3 px-4 rounded-xl bg-[#643EF3] hover:bg-[#3A1ABB] active:bg-[#3A1ABB] text-white font-semibold text-sm tracking-wide shadow-md shadow-[#643EF3]/25 hover:shadow-lg hover:shadow-[#643EF3]/35 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
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
