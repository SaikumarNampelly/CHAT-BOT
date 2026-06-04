import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { streamMessage, streamGreet } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { useThemeStore } from '../store/themeStore';
import EmojiPicker from 'emoji-picker-react';

const QUICKSTART_TEMPLATES = [];

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
  const [modalConfig, setModalConfig] = useState(null); // { title, description, confirmText, onConfirm }
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const bottomRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const greetingTriggered = useRef({});

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    api.get('/companions')
      .then(({ data }) => {
        setCompanions(data);
        if (activeCompanion?.id) {
          const fresh = data.find(c => c.id === activeCompanion.id);
          if (!fresh) {
            setActiveCompanion(null);
          } else if (fresh.companion_name !== activeCompanion.companion_name) {
            setActiveCompanion(fresh);
          }
        }
      })
      .catch(() => { });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          const companionId = activeCompanion.id;
          startStreaming();
          streamGreet(
            { companionId },
            (chunk) => appendStreamChunk(chunk),
            () => {
              finishStreaming();
              // Re-fetch from DB after greeting saved — handles race/skip cases
              setTimeout(() => {
                api.get(`/chat/history/${companionId}`)
                  .then(({ data: fresh }) => { if (fresh?.length) setMessages(fresh); })
                  .catch(() => {});
              }, 400);
            },
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

  const handleVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMsg('Speech recognition not supported in this browser.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput((prev) => prev + (prev ? ' ' : '') + transcript);
    };
    recognition.onerror = (e) => {
      setErrorMsg(`Voice error: ${e.error}`);
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  const handleClear = () => {
    if (!activeCompanion) return;
    setModalConfig({
      title: 'Clear Chat History',
      description: `Are you sure you want to clear all messages for ${getDispName(activeCompanion.companion_name)}? This action is permanent and cannot be undone.`,
      confirmText: 'Clear History',
      onConfirm: async () => {
        try {
          await api.delete(`/chat/history/${activeCompanion.id}`);
          clearHistory();
        } catch (err) {
          console.error(err);
          setErrorMsg('Failed to clear chat history.');
        }
      }
    });
  };

  const handleDeleteCompanion = (e, companionId, name) => {
    e.stopPropagation();
    setModalConfig({
      title: 'Delete Companion',
      description: `Are you sure you want to delete ${name} and all associated conversation history? This action is permanent.`,
      confirmText: 'Delete Companion',
      onConfirm: async () => {
        try {
          await api.delete(`/companions/${companionId}`);
          removeCompanion(companionId);
        } catch (err) {
          console.error('Delete companion error:', err);
        }
      }
    });
  };

  const handleCreateFromTemplate = async (tmpl) => {
    setErrorMsg('');
    setLoadingHistory(true);
    try {
      const { data: companion } = await api.post('/companions', {
        companion_name: `${tmpl.emoji || '🫂'}|${tmpl.gender || 'female'}|male|${tmpl.name}`,
        role: tmpl.role,
        scenario: tmpl.scenario,
        language: 'tanglish',
      });
      const { data: list } = await api.get('/companions');
      setCompanions(list);
      setActiveCompanion(companion);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to create template companion.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const getDispName = (name) => {
    if (!name) return '';
    const parts = name.split('|');
    if (parts.length >= 4) return parts.slice(3).join('|');
    if (parts.length >= 2) return parts.slice(1).join('|');
    return name;
  };

  const getCompanionGender = (name) => {
    if (!name) return 'companion';
    const parts = name.split('|');
    if (parts.length >= 4) return parts[1];
    return 'companion';
  };

  // Dynamic beautiful initials gradient helper
  const getAvatarGradient = (rawName) => {
    const name = getDispName(rawName);
    const charCode = name ? name.charCodeAt(0) : 65;
    const index = charCode % 5;
    const gradients = [
      'linear-gradient(135deg, #14b8a6ff 0%, #14b8a6ff 100%)', // Teal/Lagoon
      'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)', // Cyan/Sky
      'linear-gradient(135deg, #4f46e5 0%, #5456e3ff 100%)', // Indigo/Violet
      'linear-gradient(135deg, #059669 0%, #10b981 100%)', // Emerald/Green
      'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)', // Purple/Fuchsia
    ];
    return { background: gradients[index], color: '#ffffff' };
  };

  const getAvatarChar = (name) => {
    if (!name) return 'C';
    const parts = name.split('|');
    if (parts.length >= 2) return parts[0];
    return name[0]?.toUpperCase() || 'C';
  };

  return (
    <div className="chat-layout">
      {/* Mobile Sidebar Overlay */}
      <div
        className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* ============ SIDEBAR ============ */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-top">
            <div className="mark">🫂</div>
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
            New Chat
          </button>
        </div>

        <div className="list">
          {companions.length === 0 && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-low)', fontSize: '13px', lineHeight: '1.5' }}>
              No chats yet.<br />Create one to start.
            </div>
          )}
          {companions.map((c) => (
            <div key={c.id} id={`companion-${c.id}`}
              className={`companion ${activeCompanion?.id === c.id ? 'active' : ''}`}
              onClick={() => {
                setActiveCompanion(c);
                setIsSidebarOpen(false); // Close sidebar on mobile after selection
              }}>
              <div className="avatar av-md av-fill" style={getAvatarGradient(c.companion_name)}>
                {getAvatarChar(c.companion_name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="c-name">{getDispName(c.companion_name)}</div>
                <div className="c-role">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px', opacity: 0.8 }}>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  {getCompanionGender(c.companion_name)}
                </div>
              </div>
              <button
                className="btn-delete-companion"
                title="Delete companion"
                onClick={(e) => handleDeleteCompanion(e, c.id, c.companion_name)}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <div className="user-footer">
          <div className="avatar av-sm av-line" style={{ border: '1.5px solid var(--accent)', color: 'var(--accent)' }}>
            {getAvatarChar(user?.name)}
          </div>
          <span className="u-name">{user?.name}</span>
          <button id="logout-btn" className="btn-logout" onClick={() => { logout(); navigate('/login'); }} title="Logout">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
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
            <div className="n-emoji">🫂</div>
            <h2>Welcome to Your Soul</h2>
            <p>Ready to meet your premium soul sanctuary? Choose a pre-designed template below to start chatting instantly, or customize your own.</p>

            <div className="quickstart-grid">
              {QUICKSTART_TEMPLATES.map((tmpl) => (
                <div key={tmpl.name} className="quickstart-card" onClick={() => handleCreateFromTemplate(tmpl)}>
                  <div className="qs-name">{tmpl.name} • <span style={{ textTransform: 'capitalize', fontWeight: 500, fontSize: '12px' }}>{tmpl.role}</span></div>
                  <div className="qs-desc">{tmpl.description}</div>
                </div>
              ))}
            </div>

            <button className="btn-create" onClick={() => navigate('/setup')}>
              + New Chat
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <header className="chat-header">
              <button
                className="btn-mobile-menu"
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Open menu"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <div className="avatar av-md av-fill" style={getAvatarGradient(activeCompanion.companion_name)}>
                {getAvatarChar(activeCompanion.companion_name)}
              </div>
              <div className="ch-info">
                <div className="ch-name">{getDispName(activeCompanion.companion_name)}</div>
                <div className="status">
                  <span className="dot"></span> online · {getCompanionGender(activeCompanion.companion_name)}
                </div>
              </div>
              <div className="header-actions">
                {/* DARK / LIGHT TOGGLE */}
                <button className="btn-icon" id="themeToggle" onClick={toggleTheme} aria-label="Toggle theme" title="Toggle theme">
                  <svg className="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
                  <svg className="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
                </button>
                <button id="clear-history-btn" className="btn-clear" onClick={handleClear}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
                  <span className="mobile-hide">Clear</span>
                </button>
              </div>
            </header>

            {/* Messages */}
            <div className="messages-area" id="messages">
              {loadingHistory && (
                <>
                  <div className="skeleton-row" style={{ alignSelf: 'flex-start' }}>
                    <div className="skeleton-avatar" />
                    <div className="skeleton-bubble" style={{ width: '220px' }} />
                  </div>
                  <div className="skeleton-row" style={{ alignSelf: 'flex-end', flexDirection: 'row-reverse' }}>
                    <div className="skeleton-avatar" />
                    <div className="skeleton-bubble" style={{ width: '180px' }} />
                  </div>
                  <div className="skeleton-row" style={{ alignSelf: 'flex-start' }}>
                    <div className="skeleton-avatar" />
                    <div className="skeleton-bubble" style={{ width: '260px' }} />
                  </div>
                </>
              )}

              {!loadingHistory && messages.length === 0 && !isStreaming && (
                <div className="empty-state">
                  <div className="e-emoji" style={getAvatarGradient(activeCompanion.companion_name)}>
                    {getAvatarChar(activeCompanion.companion_name)}
                  </div>
                  <h3>{getDispName(activeCompanion.companion_name)} is waiting...</h3>
                  <p>Say something to start your ethereal conversation!</p>
                </div>
              )}

              {!loadingHistory && (() => {
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
                          <div className="avatar av-sm av-fill" style={getAvatarGradient(activeCompanion.companion_name)}>
                            {getAvatarChar(activeCompanion.companion_name)}
                          </div>
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
                  <div className="avatar av-sm av-fill" style={getAvatarGradient(activeCompanion.companion_name)}>
                    {getAvatarChar(activeCompanion.companion_name)}
                  </div>
                  <div className="msg-wrap">
                    <div className="bubble">
                      {streamingText
                        ? <>{streamingText}<span style={{ opacity: 0.6, animation: 'pulse 1s infinite' }}>▌</span></>
                        : <div className="typing-bubble"><div className="t-dot" /><div className="t-dot" /><div className="t-dot" /></div>
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
              <div className="composer-actions" ref={emojiPickerRef} style={{ position: 'relative' }}>
                <button className="btn-composer-action" title="Emoji" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                    <line x1="9" y1="9" x2="9.01" y2="9" />
                    <line x1="15" y1="9" x2="15.01" y2="9" />
                  </svg>
                </button>
                {showEmojiPicker && (
                  <div style={{ position: 'absolute', bottom: '100%', left: 0, zIndex: 50, marginBottom: '10px' }}>
                    <EmojiPicker
                      onEmojiClick={(emoji) => setInput(prev => prev + emoji.emoji)}
                      theme={document.documentElement.getAttribute('data-theme') || 'dark'}
                    />
                  </div>
                )}
              </div>
              <div className="field">
                <input
                  id="message-input"
                  type="text"
                  placeholder={`Message ${getDispName(activeCompanion.companion_name)}...`}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  disabled={isStreaming}
                  autoComplete="off"
                />
              </div>

              {/* Send and Voice Buttons */}
              <button
                className={`btn-voice ${isListening ? 'listening' : ''}`}
                title="Voice Message"
                aria-label="Voice Message"
                onClick={handleVoice}
                style={{
                  background: isListening ? 'rgba(248, 81, 73, 0.15)' : '',
                  color: isListening ? '#f85149' : '',
                  borderColor: isListening ? 'rgba(248, 81, 73, 0.3)' : ''
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              </button>

              <button
                id="send-btn"
                className="send"
                onClick={handleSend}
                disabled={isStreaming || !input.trim()}
                aria-label="Send"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h13M13 6l6 6-6 6" />
                </svg>
              </button>
            </footer>
          </>
        )}
      </section>

      {/* ============ CUSTOM CONFIRMATION MODAL ============ */}
      {modalConfig && (
        <div className="modal-overlay" onClick={() => setModalConfig(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{modalConfig.title}</h3>
            <p className="modal-description">{modalConfig.description}</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setModalConfig(null)}>
                Cancel
              </button>
              <button
                className="btn-danger"
                onClick={() => {
                  modalConfig.onConfirm();
                  setModalConfig(null);
                }}
              >
                {modalConfig.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
