import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { streamMessage, streamGreet } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { useThemeStore } from '../store/themeStore';

function timeStr(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getDateGroupLabel(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  if (targetDate.getTime() === today.getTime()) {
    return 'Today';
  } else if (targetDate.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
  }
}

export default function Chat() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { toggleTheme } = useThemeStore();
  const {
    companions, activeCompanion,
    messages, isStreaming, streamingText,
    setCompanions, setActiveCompanion, setMessages,
    addMessage, startStreaming, appendStreamChunk, finishStreaming,
    cancelStreaming, clearHistory, removeCompanion,
  } = useChatStore();

  const [input, setInput] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const bottomRef = useRef(null);
  const greetingTriggered = useRef({});

  useEffect(() => {
    api.get('/companions')
      .then(({ data }) => {
        setCompanions(data);
        if (activeCompanion && data && !data.some(c => c.id === activeCompanion.id)) {
          setActiveCompanion(null);
        }
      })
      .catch(() => {});
  }, [activeCompanion, setActiveCompanion]);

  useEffect(() => {
    if (!activeCompanion) return;
    setLoadingHistory(true);
    setErrorMsg('');
    api.get(`/chat/history/${activeCompanion.id}`)
      .then(({ data }) => {
        setMessages(data);
        // If no history, auto-send companion's first greeting
        if ((!data || data.length === 0) && !greetingTriggered.current[activeCompanion.id]) {
          greetingTriggered.current[activeCompanion.id] = true;
          startStreaming();
          streamGreet(
            { companionId: activeCompanion.id },
            (chunk) => appendStreamChunk(chunk),
            () => finishStreaming(),
            (err) => {
              console.error('Greet error:', err);
              setErrorMsg(err);
              cancelStreaming();
              greetingTriggered.current[activeCompanion.id] = false;
            }
          );
        }
      })
      .catch(() => setMessages([]))
      .finally(() => setLoadingHistory(false));
  }, [activeCompanion?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming || !activeCompanion) return;
    setInput('');
    setErrorMsg('');
    addMessage({ role: 'user', content: text, id: Date.now(), created_at: new Date().toISOString() });
    startStreaming();
    streamMessage(
      { companionId: activeCompanion.id, message: text },
      (chunk) => appendStreamChunk(chunk),
      () => finishStreaming(),
      (err) => {
        console.error(err);
        setErrorMsg(err);
        cancelStreaming();
      }
    );
  }, [input, isStreaming, activeCompanion]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleClear = async () => {
    if (!activeCompanion) return;
    if (!window.confirm('Clear all messages for this companion?')) return;
    await api.delete(`/chat/history/${activeCompanion.id}`);
    clearHistory();
  };

  const handleDeleteCompanion = async (e, companionId) => {
    e.stopPropagation();
    if (!window.confirm('Delete this companion and all their messages?')) return;
    try {
      await api.delete(`/companions/${companionId}`);
      removeCompanion(companionId);
    } catch (err) {
      console.error('Delete companion error:', err);
    }
  };

  // Avatar helper
  const getAvatarChar = (name) => name?.[0]?.toLowerCase() || 'c';

  return (
    <div className="chat-layout">

      {/* ============ SIDEBAR ============ */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-top">
            <div className="mark" style={{ fontSize: '20px' }}>🫂</div>
            <div>
              <span className="brand-name">Your Soul</span>
              <span className="brand-tag">Feel the connection</span>
            </div>
          </div>
          <button id="new-companion-btn" className="btn-new" onClick={() => navigate('/setup')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Companion
          </button>
        </div>

        <div className="list">
          <div className="list-label">// active</div>
          {companions.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-mid)', fontSize: '12px', fontFamily: 'Space Mono, monospace' }}>
              No companions yet.<br />Create one to start.
            </div>
          )}
          {companions.map((c) => (
            <div key={c.id} id={`companion-${c.id}`}
              className={`companion ${activeCompanion?.id === c.id ? 'active' : ''}`}
              onClick={() => setActiveCompanion(c)}>
              <div className="avatar av-md av-fill">{getAvatarChar(c.companion_name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="c-name">{c.companion_name}</div>
                <div className="c-role">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px', opacity: 0.8 }}>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  {c.gender || 'companion'}
                </div>
              </div>
              <button
                className="btn-delete-companion"
                title="Delete companion"
                onClick={(e) => handleDeleteCompanion(e, c.id)}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <div className="user-footer">
          <div className="avatar av-sm av-line">{getAvatarChar(user?.name)}</div>
          <span className="u-name">{user?.name}</span>
          <button id="logout-btn" className="btn-logout" onClick={() => { logout(); navigate('/login'); }} title="Logout">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </aside>

      {/* ============ MAIN CHAT ============ */}
      <section className="chat-main">
        {!activeCompanion ? (
          <div className="no-companion">
            <div className="n-emoji" style={{ fontSize: '24px' }}>🫂</div>
            <h2>Welcome to Your Soul</h2>
            <p>Select a companion from the sidebar or create a new one to start chatting.</p>
            <button className="btn-create" onClick={() => navigate('/setup')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Create Companion
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <header className="chat-header">
              <div className="avatar av-md av-fill">{getAvatarChar(activeCompanion.companion_name)}</div>
              <div className="ch-info">
                <div className="ch-name">{activeCompanion.companion_name}</div>
                <div className="status">
                  <span className="dot"></span> online · {activeCompanion.gender || 'companion'}
                </div>
              </div>
              <div className="header-actions">
                {/* DARK / LIGHT TOGGLE */}
                <button className="btn-icon" id="themeToggle" onClick={toggleTheme} aria-label="Toggle theme" title="Toggle theme">
                  <svg className="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>
                  <svg className="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
                </button>
                <button id="clear-history-btn" className="btn-clear" onClick={handleClear}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
                  Clear
                </button>
              </div>
            </header>

            {/* Messages */}
            <div className="messages-area" id="messages">
              {loadingHistory && (
                <div style={{ textAlign: 'center', color: 'var(--text-mid)', fontSize: '12px', padding: '20px', fontFamily: 'Space Mono, monospace' }}>
                  Loading messages...
                </div>
              )}

              {!loadingHistory && messages.length === 0 && !isStreaming && (
                <div className="empty-state">
                  <div className="e-emoji">{getAvatarChar(activeCompanion.companion_name)}</div>
                  <h3>{activeCompanion.companion_name} is waiting...</h3>
                  <p>Say something to get started!</p>
                </div>
              )}

              {(() => {
                let lastDateLabel = null;
                return messages.map((msg, i) => {
                  const dateLabel = getDateGroupLabel(msg.created_at);
                  const showSeparator = dateLabel && dateLabel !== lastDateLabel;
                  lastDateLabel = dateLabel;

                  return (
                    <React.Fragment key={msg.id || i}>
                      {showSeparator && (
                        <div className="chat-date-separator">
                          <span className="chat-date-label">{dateLabel}</span>
                        </div>
                      )}
                      <div className={`row ${msg.role === 'user' ? 'sent' : 'recv'}`}>
                        {msg.role === 'assistant' && (
                          <div className="avatar av-sm av-fill">{getAvatarChar(activeCompanion.companion_name)}</div>
                        )}
                        <div className="msg-wrap">
                          <div className="bubble">{msg.content}</div>
                          <span className="time">{timeStr(msg.created_at)}</span>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                });
              })()}

              {isStreaming && (
                <div className="row recv">
                  <div className="avatar av-sm av-fill">{getAvatarChar(activeCompanion.companion_name)}</div>
                  <div className="msg-wrap">
                    <div className="bubble">
                      {streamingText
                        ? <>{streamingText}<span style={{ opacity: 0.4 }}>▌</span></>
                        : <div className="typing-bubble"><div className="t-dot"/><div className="t-dot"/><div className="t-dot"/></div>
                      }
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {errorMsg && (
              <div className="chat-error-banner">
                <span>⚠️ {errorMsg}</span>
                <button onClick={() => setErrorMsg('')} className="btn-close-error">×</button>
              </div>
            )}

            {/* Input */}
            <footer className="composer">
              <div className="field">
                <input
                  id="message-input"
                  type="text"
                  placeholder={`Message ${activeCompanion.companion_name}...`}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  disabled={isStreaming}
                  autoComplete="off"
                />
              </div>
              <button
                id="send-btn"
                className="send"
                onClick={handleSend}
                disabled={isStreaming || !input.trim()}
                aria-label="Send"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M5 12h13M13 6l6 6-6 6"/>
                </svg>
              </button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
