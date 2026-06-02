import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useChatStore } from '../store/chatStore';
import { useThemeStore } from '../store/themeStore';

const GENDER_OPTIONS = [
  { 
    id: 'female', 
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="9" r="4" />
        <path d="M12 13v8M9 17h6" />
      </svg>
    ), 
    label: 'Female' 
  },
  { 
    id: 'male',   
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="9" r="4" />
        <path d="M12 13v8M12 17h-2M14 17h-2" />
      </svg>
    ), 
    label: 'Male'   
  },
  { 
    id: 'other',  
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
  const { toggleTheme } = useThemeStore();

  const [companionName, setCompanionName] = useState('');
  const [gender, setGender]               = useState('female');
  const [scenario, setScenario]           = useState('');
  const [error, setError]                 = useState('');
  const [loading, setLoading]             = useState(false);

  const handleCreate = async () => {
    if (!companionName.trim()) { setError('Please enter a name for your companion.'); return; }
    setError(''); setLoading(true);
    try {
      const { data: companion } = await api.post('/companions', {
        companion_name: companionName.trim(),
        role: 'friend',          // default role — personality driven by gender + scenario
        scenario: scenario.trim(),
        language: 'tanglish',
      });
      const { data: list } = await api.get('/companions');
      setCompanions(list);
      setActiveCompanion({ ...companion, gender });
      navigate('/chat');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create companion.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setup-page">
      <button className="theme-toggle-auth" onClick={toggleTheme} aria-label="Toggle theme" title="Toggle theme">
        <svg className="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>
        <svg className="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
      </button>

      <div className="setup-card">
        <div className="setup-header">
          <div className="brand-row">
            <div className="brand-icon" style={{ fontSize: '20px' }}>🫂</div>
            <h2>Your Soul</h2>
          </div>
          <p>Start Your Journey with your soul</p>
        </div>

        {error && <div className="error-msg">⚠️ {error}</div>}

        {/* Companion Name */}
        <div className="setup-section">
          <div className="section-label">What's their name?</div>
          <div className="name-wrap">
            <span className="name-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-low)', display: 'block' }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </span>
            <input
              id="companion-name-input"
              type="text"
              className="name-input"
              placeholder="e.g. Priya, Arjun, Meera..."
              value={companionName}
              onChange={(e) => setCompanionName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
        </div>

        {/* Gender */}
        <div className="setup-section">
          <div className="section-label">Who are they?</div>
          <div className="gender-row">
            {GENDER_OPTIONS.map((g) => (
              <button
                key={g.id}
                id={`gender-${g.id}`}
                className={`gender-btn ${gender === g.id ? 'active' : ''}`}
                onClick={() => setGender(g.id)}
              >
                {g.icon}
                <span className="g-label">{g.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Context / Scenario */}
        <div className="setup-section">
          <div className="section-label">Any context? <span style={{ fontWeight: 400, textTransform: 'none', color: 'var(--text-mid)' }}>(optional)</span></div>
          <textarea
            className="scenario-textarea" rows={4}
            placeholder={"Tell them a bit about you or your situation...\ne.g. I'm a college student dealing with exams. I need someone to talk to."}
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
          />
        </div>

        <button id="create-companion-btn" className="btn-primary" onClick={handleCreate} disabled={loading}>
          {loading ? 'Setting up...' : `Start chatting with ${companionName || 'your person'} →`}
        </button>
      </div>
    </div>
  );
}
