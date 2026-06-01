import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useChatStore } from '../store/chatStore';

const GENDER_OPTIONS = [
  { id: 'female', emoji: '👩', label: 'Female' },
  { id: 'male',   emoji: '👨', label: 'Male'   },
  { id: 'other',  emoji: '🧑', label: 'Other'  },
];

export default function CompanionSetup() {
  const navigate = useNavigate();
  const { setCompanions, setActiveCompanion } = useChatStore();

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
      <div className="setup-card">
        <div className="setup-header">
          <div className="brand-row">
            <div className="brand-icon">🫂</div>
            <h2>Your Soul</h2>
          </div>
          <p>Create your AI companion</p>
        </div>

        {error && <div className="error-msg">⚠️ {error}</div>}

        {/* Companion Name */}
        <div className="setup-section">
          <div className="section-label">What's their name?</div>
          <div className="name-wrap">
            <span className="name-icon">👤</span>
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
                <span className="g-emoji">{g.emoji}</span>
                <span className="g-label">{g.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Context / Scenario */}
        <div className="setup-section">
          <div className="section-label">Any context? <span style={{ fontWeight: 400, textTransform: 'none', color: 'var(--text-3)' }}>(optional)</span></div>
          <textarea
            className="scenario-textarea" rows={4}
            placeholder={"Tell them a bit about you or your situation...\ne.g. I'm a college student dealing with exams. I need someone to talk to."}
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
          />
        </div>

        <button id="create-companion-btn" className="btn-primary" onClick={handleCreate} disabled={loading}>
          {loading ? 'Setting up...' : `Start chatting with ${companionName || 'your companion'} →`}
        </button>
      </div>
    </div>
  );
}
