import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { streamMessage, streamGreet } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';

const GENDER_EMOJIS = { female: '👩', male: '👨', other: '🧑' };

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

  // Avatar: use gender emoji if stored, fallback to 🫂
  const getAvatar = (c) => GENDER_EMOJIS[c?.gender] || '🫂';

  return (
    <div className="chat-layout">

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <div className="b-icon">🫂</div>
            <span>Your Soul</span>
          </div>
          <button id="new-companion-btn" className="btn-new" onClick={() => navigate('/setup')}>+ New</button>
        </div>

        <div className="sidebar-list">
          {companions.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-3)', fontSize: '12px' }}>
              No companions yet.<br />Create one to start.
            </div>
          )}
          {companions.map((c) => (
            <div key={c.id} id={`companion-${c.id}`}
              className={`companion-item ${activeCompanion?.id === c.id ? 'active' : ''}`}
              onClick={() => setActiveCompanion(c)}>
              <div className="c-avatar">{getAvatar(c)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="c-name">{c.companion_name}</div>
                <div className="c-role">{c.gender || 'companion'}</div>
              </div>
              <button
                className="btn-delete-companion"
                title="Delete companion"
                onClick={(e) => handleDeleteCompanion(e, c.id)}
              >🗑</button>
            </div>
          ))}
        </div>

        <div className="sidebar-bottom">
          <div className="u-avatar">{user?.name?.[0]?.toUpperCase()}</div>
          <span className="u-name">{user?.name}</span>
          <button id="logout-btn" className="btn-logout" onClick={() => { logout(); navigate('/login'); }} title="Logout">⎋</button>
        </div>
      </aside>

      {/* Main */}
      <div className="chat-main">
        {!activeCompanion ? (
          <div className="no-companion">
            <div className="n-emoji">🫂</div>
            <h2>Welcome to Your Soul</h2>
            <p>Select a companion from the sidebar or create a new one to start chatting.</p>
            <button className="btn-create" onClick={() => navigate('/setup')}>+ Create Companion</button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="chat-header">
              <div className="ch-avatar">{getAvatar(activeCompanion)}</div>
              <div>
                <div className="ch-name">
                  <span className="online-dot" />{activeCompanion.companion_name}
                </div>
                <div className="ch-status">{activeCompanion.gender || 'companion'}</div>
              </div>
              <button id="clear-history-btn" className="btn-clear" onClick={handleClear}>🗑 Clear</button>
            </div>

            {/* Messages */}
            <div className="messages-area">
              {loadingHistory && (
                <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: '12px', padding: '20px' }}>
                  Loading messages...
                </div>
              )}

              {!loadingHistory && messages.length === 0 && !isStreaming && (
                <div className="empty-state">
                  <div className="e-emoji">{getAvatar(activeCompanion)}</div>
                  <h3>{activeCompanion.companion_name} is waiting for you...</h3>
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
                      <div className={`msg-row ${msg.role === 'user' ? 'user' : 'ai'}`}>
                        {msg.role === 'assistant' && (
                          <div className="msg-av">{getAvatar(activeCompanion)}</div>
                        )}
                        <div className={`msg-content ${msg.role === 'user' ? 'user' : 'ai'}`}>
                          <div className="msg-bubble">{msg.content}</div>
                          <div className="msg-time">{timeStr(msg.created_at)}</div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                });
              })()}

              {isStreaming && (
                <div className="msg-row ai">
                  <div className="msg-av">{getAvatar(activeCompanion)}</div>
                  <div className="msg-content ai">
                    {streamingText
                      ? <div className="msg-bubble">{streamingText}<span style={{ opacity: 0.4 }}>▌</span></div>
                      : <div className="typing-bubble"><div className="t-dot"/><div className="t-dot"/><div className="t-dot"/></div>
                    }
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
            <div className="input-area">
              <div className="input-row">
                <textarea
                  id="message-input" className="msg-input" rows={1}
                  placeholder={`Message ${activeCompanion.companion_name}...`}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  disabled={isStreaming}
                />
                <button id="send-btn" className="send-btn"
                  onClick={handleSend} disabled={isStreaming || !input.trim()}>
                  ➤
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
