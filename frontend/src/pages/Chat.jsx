import { Fragment, useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { streamMessage, streamGreet } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { useThemeStore } from '../store/themeStore';
import EmojiPicker from 'emoji-picker-react';

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

  const dateFormatted = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  if (targetDate.getTime() === today.getTime()) {
    return `Today, ${dateFormatted}`;
  } else if (targetDate.getTime() === yesterday.getTime()) {
    return `Yesterday, ${dateFormatted}`;
  } else {
    return dateFormatted;
  }
}

const QUICK_PRESETS = [
  { name: 'Priya', gender: 'female', emoji: '🌸', desc: 'Sweet & caring bestie' },
  { name: 'Arjun', gender: 'male', emoji: '⚡', desc: 'Chill & supportive buddy' },
  { name: 'Ananya', gender: 'female', emoji: '✨', desc: 'Smart & cheerful' },
];

export default function Chat() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const {
    companions, activeCompanion,
    messages, isStreaming, streamingText,
    setCompanions, setActiveCompanion, setMessages,
    addMessage, startStreaming, appendStreamChunk, finishStreaming,
    cancelStreaming, clearHistory, removeCompanion,
  } = useChatStore();

  const [input, setInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [modalConfig, setModalConfig] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // New Chat Modal state
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newCompanionName, setNewCompanionName] = useState('');
  const [newCompanionGender, setNewCompanionGender] = useState('female');
  const [newUserGender, setNewUserGender] = useState('male');
  const [newScenario, setNewScenario] = useState('');
  const [newEmoji, setNewEmoji] = useState('🫂');
  const [showModalEmojiPicker, setShowModalEmojiPicker] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const [createChatError, setCreateChatError] = useState('');

  const bottomRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const modalEmojiRef = useRef(null);
  const searchInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const greetingTriggered = useRef({});

  // Close emoji picker on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
      if (modalEmojiRef.current && !modalEmojiRef.current.contains(e.target)) {
        setShowModalEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut: Ctrl + K or Cmd + K to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch companions list & auto-select
  useEffect(() => {
    api.get('/companions')
      .then(({ data }) => {
        const list = data || [];
        setCompanions(list);
        if (list.length > 0) {
          if (activeCompanion?.id) {
            const fresh = list.find(c => c.id === activeCompanion.id);
            if (fresh) {
              if (fresh.companion_name !== activeCompanion.companion_name) {
                setActiveCompanion(fresh);
              }
            } else {
              setActiveCompanion(list[0]);
            }
          } else {
            setActiveCompanion(list[0]);
          }
        } else {
          setActiveCompanion(null);
        }
      })
      .catch(() => { });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateCompanion = async (nameOverride, genderOverride, emojiOverride) => {
    const finalName = (nameOverride || newCompanionName).trim();
    if (!finalName) {
      setCreateChatError('Please enter a name for your companion.');
      return;
    }
    const finalGender = genderOverride || newCompanionGender;
    const finalEmoji = emojiOverride || newEmoji;
    setCreateChatError('');
    setCreatingChat(true);

    try {
      const { data: newComp } = await api.post('/companions', {
        companion_name: `${finalEmoji}|${finalGender}|${newUserGender}|${finalName}`,
        role: 'friend',
        scenario: newScenario.trim(),
        language: 'tanglish',
      });

      const { data: list } = await api.get('/companions');
      setCompanions(list || [newComp]);
      setActiveCompanion(newComp);
      setShowNewChatModal(false);
      setNewCompanionName('');
      setNewScenario('');
      setIsSidebarOpen(false);
    } catch (err) {
      console.error('Failed to create companion:', err);
      setCreateChatError(err.response?.data?.error || 'Failed to start new chat. Please try again.');
    } finally {
      setCreatingChat(false);
    }
  };

  const handleQuickStart = () => {
    handleCreateCompanion('Priya', 'female', '🌸');
  };

  // Load chat history and trigger greeting if new
  useEffect(() => {
    if (!activeCompanion?.id) return;
    let isMounted = true;

    const loadHistoryAndGreet = async () => {
      setLoadingHistory(true);
      setErrorMsg('');
      try {
        const { data } = await api.get(`/chat/history/${activeCompanion.id}`);
        if (!isMounted) return;
        setMessages(data || []);

        if ((!data || data.length === 0) && !greetingTriggered.current[activeCompanion.id]) {
          greetingTriggered.current[activeCompanion.id] = true;
          const companionId = activeCompanion.id;
          startStreaming();
          streamGreet(
            { companionId },
            (chunk) => appendStreamChunk(chunk),
            () => finishStreaming(),
            (err) => {
              console.error('Greet error:', err);
              setErrorMsg(err);
              cancelStreaming();
              greetingTriggered.current[companionId] = false;
            }
          );
        }
      } catch {
        if (isMounted) setMessages([]);
      } finally {
        if (isMounted) setLoadingHistory(false);
      }
    };

    loadHistoryAndGreet();
    return () => { isMounted = false; };
  }, [activeCompanion?.id, appendStreamChunk, cancelStreaming, finishStreaming, setMessages, startStreaming]);

  // Scroll to bottom on new message
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
  }, [input, isStreaming, activeCompanion, addMessage, appendStreamChunk, cancelStreaming, finishStreaming, startStreaming]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMsg('Speech recognition not supported in this browser.');
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
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
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.start();
  };

  const handleClear = () => {
    if (!activeCompanion) return;
    setModalConfig({
      title: 'Clear Chat History',
      description: `Are you sure you want to clear all messages for ${getDispName(activeCompanion.companion_name)}? This action is permanent.`,
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
    const displayName = getDispName(name);
    setModalConfig({
      title: 'Delete Companion',
      description: `Are you sure you want to delete ${displayName} and all conversation history?`,
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

  const getDispName = (name) => {
    if (!name) return '';
    const parts = name.split('|');
    if (parts.length >= 4) return parts.slice(3).join('|');
    if (parts.length >= 2) return parts.slice(1).join('|');
    return name;
  };

  const getCompanionGender = (name) => {
    if (!name) return 'Companion';
    const parts = name.split('|');
    if (parts.length >= 4) return parts[1] || 'Companion';
    return 'Companion';
  };

  const getAvatarGradient = (rawName) => {
    const name = getDispName(rawName);
    const charCode = name ? name.charCodeAt(0) : 65;
    const gradients = [
      'from-teal-500 to-emerald-600',
      'from-sky-500 to-blue-600',
      'from-indigo-500 to-purple-600',
      'from-emerald-500 to-teal-700',
      'from-violet-500 to-indigo-700',
    ];
    return gradients[charCode % gradients.length];
  };

  const getAvatarChar = (name) => {
    if (!name) return 'C';
    const parts = name.split('|');
    if (parts.length >= 2) return parts[0];
    return name[0]?.toUpperCase() || 'C';
  };

  const filteredCompanions = companions.filter((c) => {
    if (!searchQuery.trim()) return true;
    const displayName = getDispName(c.companion_name).toLowerCase();
    return displayName.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="relative flex h-screen h-dvh w-full bg-slate-100/30 dark:bg-[#060a0a]/60 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-30 md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ============ SIDEBAR ============ */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-80 md:w-80 flex flex-col bg-white/95 dark:bg-[#090f0e]/95 border-r border-slate-200 dark:border-teal-500/15 backdrop-blur-xl transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand & New Chat */}
        <div className="p-4 border-b border-slate-200/80 dark:border-teal-500/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img
                src="/talkmate-icon.png"
                alt="TalkMate"
                className="w-8 h-8 rounded-xl object-cover shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10"
              />
              <div>
                <span className="block font-bold text-sm tracking-tight text-slate-900 dark:text-white leading-tight">
                  Talk<span className="text-purple-600 dark:text-purple-400">Mate</span>
                </span>
                <span className="block text-[10px] text-teal-600 dark:text-teal-400 font-medium tracking-wide">Feel the connection</span>
              </div>
            </div>

            <button
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              ✕
            </button>
          </div>

          <button
            id="new-companion-btn"
            onClick={() => setShowNewChatModal(true)}
            className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 active:scale-[0.99] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-md shadow-teal-600/20 transition-all cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Chat
          </button>

          {/* Search bar with shortcut */}
          <div className="relative flex items-center">
            <svg className="absolute left-3 w-3.5 h-3.5 text-slate-400 dark:text-teal-500/60 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-16 py-1.5 rounded-xl border border-slate-200 dark:border-teal-500/20 bg-slate-50 dark:bg-[#060a0a]/60 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all"
            />
            <span className="absolute right-2 px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-200/70 dark:bg-teal-950/60 text-slate-500 dark:text-teal-400/80 border border-slate-300/50 dark:border-teal-500/20 pointer-events-none">
              Ctrl+K
            </span>
          </div>
        </div>

        {/* Section Heading */}
        <div className="px-4 py-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          <span>Chats</span>
          <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-teal-950/50 text-slate-600 dark:text-teal-400">
            {filteredCompanions.length}
          </span>
        </div>

        {/* Companion List */}
        <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1">
          {filteredCompanions.length === 0 && (
            <div className="text-center py-10 px-4 text-xs text-slate-400 dark:text-slate-500 whitespace-pre-line leading-relaxed">
              {searchQuery ? 'No chats found matching search.' : 'No chats yet.\nCreate one to start.'}
            </div>
          )}

          {filteredCompanions.map((c) => {
            const isActive = activeCompanion?.id === c.id;
            return (
              <div
                key={c.id}
                id={`companion-${c.id}`}
                onClick={() => {
                  setActiveCompanion(c);
                  setIsSidebarOpen(false);
                }}
                className={`group relative flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer transition-all ${
                  isActive
                    ? 'bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-500/30 text-teal-950 dark:text-white shadow-xs'
                    : 'hover:bg-slate-100 dark:hover:bg-[#111e1c]/60 text-slate-700 dark:text-slate-300 border border-transparent'
                }`}
              >
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarGradient(c.companion_name)} flex items-center justify-center text-white text-base font-semibold shadow-xs shrink-0`}>
                  {getAvatarChar(c.companion_name)}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs sm:text-sm truncate text-slate-800 dark:text-slate-100">
                      {getDispName(c.companion_name)}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                      01:32 PM
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0 animate-pulse"></span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      Online • {getCompanionGender(c.companion_name)}
                    </span>
                  </div>
                </div>

                {/* Delete button */}
                <button
                  type="button"
                  title="Delete companion"
                  onClick={(e) => handleDeleteCompanion(e, c.id, c.companion_name)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all shrink-0 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>

        {/* User Footer */}
        <div className="p-3 border-t border-slate-200/80 dark:border-teal-500/10 flex items-center justify-between gap-2 bg-slate-50/50 dark:bg-[#060a0a]/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-teal-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
              {getAvatarChar(user?.name)}
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{user?.name || 'User'}</span>
              <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Online
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleTheme}
              title="Toggle theme"
              className="p-2 rounded-xl text-slate-500 dark:text-teal-400 hover:bg-slate-200 dark:hover:bg-teal-950/50 transition-colors cursor-pointer"
            >
              {theme === 'dark' ? (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
                </svg>
              )}
            </button>
            <button
              id="logout-btn"
              onClick={() => { logout(); navigate('/login'); }}
              title="Logout"
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ============ MAIN CHAT CONTAINER ============ */}
      <section className="flex-1 flex flex-col h-full min-w-0 bg-slate-50/75 dark:bg-[#060a0a]/75 backdrop-blur-[2px] relative">
        {!activeCompanion ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="relative mb-4">
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-teal-400 via-blue-500 to-purple-600 opacity-25 blur-lg"></div>
              <img
                src="/talkmate-icon.png"
                alt="TalkMate"
                className="relative w-20 h-20 rounded-3xl object-cover shadow-xl border border-white/20"
              />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              Welcome to Talk<span className="text-purple-600 dark:text-purple-400">Mate</span>
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mt-2 mb-6">
              Connect with your personal companion. Pick a chat from the sidebar or start fresh.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                id="quick-start-chat-btn"
                type="button"
                disabled={creatingChat}
                onClick={handleQuickStart}
                className="py-2.5 px-6 rounded-xl bg-teal-600 hover:bg-teal-500 active:scale-[0.99] text-white font-semibold text-sm shadow-md shadow-teal-600/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-60"
              >
                {creatingChat ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Starting chat...</span>
                  </>
                ) : (
                  <>
                    <span>💬</span>
                    <span>Start Chatting Now</span>
                  </>
                )}
              </button>
              <button
                id="customize-new-chat-btn"
                type="button"
                onClick={() => setShowNewChatModal(true)}
                className="py-2.5 px-5 rounded-xl border border-slate-300 dark:border-teal-500/30 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-teal-950/40 font-medium text-sm transition-all cursor-pointer"
              >
                + Customize Companion
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Top Header */}
            <header className="h-16 px-4 sm:px-6 border-b border-slate-200/90 dark:border-teal-500/15 bg-white/80 dark:bg-[#0c1413]/80 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 z-10">
              <div className="flex items-center gap-3 min-w-0">
                {/* Mobile sidebar toggle button */}
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(true)}
                  aria-label="Open menu"
                  className="md:hidden p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                </button>

                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarGradient(activeCompanion.companion_name)} flex items-center justify-center text-white text-base font-semibold shadow-xs shrink-0`}>
                  {getAvatarChar(activeCompanion.companion_name)}
                </div>

                <div className="min-w-0">
                  <div className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                    {getDispName(activeCompanion.companion_name)}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                    <span className="truncate">Online • {getCompanionGender(activeCompanion.companion_name)}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  title="Voice call"
                  onClick={() => alert(`Starting voice call with ${getDispName(activeCompanion.companion_name)}...`)}
                  className="p-2 sm:p-2.5 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-teal-950/40 transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </button>

                <button
                  type="button"
                  title="Video call"
                  onClick={() => alert(`Starting video call with ${getDispName(activeCompanion.companion_name)}...`)}
                  className="p-2 sm:p-2.5 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-teal-950/40 transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                </button>

                <button
                  type="button"
                  id="clear-history-btn"
                  onClick={handleClear}
                  title="Clear history"
                  className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl border border-slate-200 dark:border-teal-500/20 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 transition-colors cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                  </svg>
                  <span className="hidden sm:inline">Clear</span>
                </button>
              </div>
            </header>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4" id="messages">
              {loadingHistory && (
                <div className="space-y-4 py-4">
                  <div className="flex items-start gap-2.5 max-w-xs animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800" />
                    <div className="h-12 w-48 rounded-2xl bg-slate-200 dark:bg-slate-800" />
                  </div>
                  <div className="flex items-start gap-2.5 max-w-xs ml-auto flex-row-reverse animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800" />
                    <div className="h-10 w-40 rounded-2xl bg-slate-200 dark:bg-slate-800" />
                  </div>
                </div>
              )}

              {!loadingHistory && messages.length === 0 && !isStreaming && (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className={`w-16 h-16 rounded-3xl bg-gradient-to-br ${getAvatarGradient(activeCompanion.companion_name)} flex items-center justify-center text-white text-2xl shadow-lg mb-3`}>
                    {getAvatarChar(activeCompanion.companion_name)}
                  </div>
                  <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">
                    {getDispName(activeCompanion.companion_name)} is waiting...
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Say something to start your conversation!
                  </p>
                </div>
              )}

              {!loadingHistory && (() => {
                let lastDateLabel = null;
                return messages.map((msg, i) => {
                  const dateLabel = getDateGroupLabel(msg.created_at);
                  const showSeparator = dateLabel && dateLabel !== lastDateLabel;
                  lastDateLabel = dateLabel;

                  return (
                    <Fragment key={msg.id || i}>
                      {showSeparator && (
                        <div className="flex items-center justify-center my-4">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-slate-200/80 dark:bg-[#111e1c] text-slate-600 dark:text-teal-400/90 border border-slate-300/40 dark:border-teal-500/15 shadow-2xs">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                              <line x1="16" y1="2" x2="16" y2="6"></line>
                              <line x1="8" y1="2" x2="8" y2="6"></line>
                              <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                            {dateLabel}
                          </span>
                        </div>
                      )}

                      <div className={`flex items-end gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                          <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${getAvatarGradient(activeCompanion.companion_name)} flex items-center justify-center text-white text-xs font-semibold shadow-xs shrink-0 mb-1`}>
                            {getAvatarChar(activeCompanion.companion_name)}
                          </div>
                        )}

                        <div className="flex flex-col max-w-[85%] sm:max-w-[70%]">
                          <div
                            className={`p-3 sm:p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words ${
                              msg.role === 'user'
                                ? 'bg-teal-600 text-white rounded-br-xs shadow-md shadow-teal-600/15'
                                : 'bg-white dark:bg-[#101b19] text-slate-900 dark:text-slate-100 rounded-bl-xs border border-slate-200/80 dark:border-teal-500/20 shadow-xs'
                            }`}
                          >
                            {msg.content}
                          </div>

                          <div className={`flex items-center gap-1.5 mt-1 px-1 text-[10px] text-slate-400 dark:text-slate-500 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <span>{timeStr(msg.created_at)}</span>
                            {msg.role === 'user' && (
                              <span title="Delivered & read" className="text-teal-600 dark:text-teal-400">
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="18 6 9 17 4 12" />
                                  <polyline points="22 10 13 21 11 19" />
                                </svg>
                              </span>
                            )}
                          </div>
                        </div>

                        {msg.role === 'user' && (
                          <div className="w-7 h-7 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mb-1">
                            {getAvatarChar(user?.name)}
                          </div>
                        )}
                      </div>
                    </Fragment>
                  );
                });
              })()}

              {isStreaming && (
                <div className="flex items-end gap-2.5 justify-start">
                  <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${getAvatarGradient(activeCompanion.companion_name)} flex items-center justify-center text-white text-xs font-semibold shadow-xs shrink-0 mb-1`}>
                    {getAvatarChar(activeCompanion.companion_name)}
                  </div>
                  <div className="p-3 sm:p-3.5 rounded-2xl rounded-bl-xs bg-white dark:bg-[#101b19] border border-slate-200/80 dark:border-teal-500/20 text-xs sm:text-sm text-slate-900 dark:text-slate-100 shadow-xs">
                    {streamingText ? (
                      <>
                        <span>{streamingText}</span>
                        <span className="inline-block opacity-70 animate-pulse ml-0.5">▌</span>
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5 py-1 px-1">
                        <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce"></span>
                        <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce [animation-delay:0.15s]"></span>
                        <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce [animation-delay:0.3s]"></span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {errorMsg && (
              <div className="mx-4 mb-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
                <span>⚠️ {errorMsg}</span>
                <button onClick={() => setErrorMsg('')} className="font-bold text-sm px-2 cursor-pointer">×</button>
              </div>
            )}

            {/* Input Composer */}
            <footer className="p-3 sm:p-4 bg-white/90 dark:bg-[#0c1413]/90 border-t border-slate-200/80 dark:border-teal-500/15 backdrop-blur-md flex items-center gap-2">
              <div className="relative flex-1 flex items-center bg-slate-100 dark:bg-[#060a0a] border border-slate-200 dark:border-teal-500/20 rounded-full px-3 py-1.5 shadow-inner">
                {/* Emoji button */}
                <button
                  type="button"
                  title="Emoji"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-1 text-slate-500 dark:text-teal-400 hover:text-slate-700 dark:hover:text-teal-300 transition-colors cursor-pointer shrink-0"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                    <line x1="9" y1="9" x2="9.01" y2="9" />
                    <line x1="15" y1="9" x2="15.01" y2="9" />
                  </svg>
                </button>

                {showEmojiPicker && (
                  <div className="absolute bottom-full left-0 mb-3 z-50 shadow-2xl rounded-2xl overflow-hidden" ref={emojiPickerRef}>
                    <EmojiPicker
                      onEmojiClick={(emoji) => setInput(prev => prev + emoji.emoji)}
                      theme={theme === 'dark' ? 'dark' : 'light'}
                    />
                  </div>
                )}

                <input
                  id="message-input"
                  type="text"
                  placeholder="Type a message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  disabled={isStreaming}
                  autoComplete="off"
                  className="flex-1 bg-transparent px-2.5 py-1 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
                />
              </div>

              {/* Attachment button */}
              <button
                type="button"
                title="Attach file"
                onClick={() => alert('Attachment feature coming soon!')}
                className="w-10 h-10 rounded-full border border-slate-200 dark:border-teal-500/20 bg-slate-100 dark:bg-[#0c1413] text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-teal-950/40 transition-all cursor-pointer shrink-0"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              </button>

              {/* Voice button */}
              <button
                type="button"
                title="Voice Message"
                aria-label="Voice Message"
                onClick={handleVoice}
                className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                  isListening
                    ? 'border-rose-500 bg-rose-500/20 text-rose-500 ring-2 ring-rose-500 animate-voice-pulse'
                    : 'border-slate-200 dark:border-teal-500/20 bg-slate-100 dark:bg-[#0c1413] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-teal-950/40'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              </button>

              {/* Send button */}
              <button
                type="button"
                id="send-btn"
                onClick={handleSend}
                disabled={isStreaming || !input.trim()}
                aria-label="Send"
                className="w-10 h-10 rounded-full bg-teal-600 hover:bg-teal-500 active:scale-95 text-white flex items-center justify-center shadow-md shadow-teal-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0"
              >
                <svg className="w-4 h-4 translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </footer>
          </>
        )}
      </section>

      {/* ============ CONFIRMATION MODAL ============ */}
      {modalConfig && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setModalConfig(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#101c1a] border border-slate-200 dark:border-teal-500/20 p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              {modalConfig.title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {modalConfig.description}
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setModalConfig(null)}
                className="py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  modalConfig.onConfirm();
                  setModalConfig(null);
                }}
                className="py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                {modalConfig.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ NEW CHAT MODAL ============ */}
      {showNewChatModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
          onClick={() => setShowNewChatModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white dark:bg-[#0c1413] border border-slate-200 dark:border-teal-500/30 p-6 sm:p-7 shadow-2xl space-y-4 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-teal-500/15 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-600 dark:text-teal-400 text-lg">
                  💬
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    Start a New Chat
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Pick a friend preset or customize your companion
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNewChatModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quick Pick Presets */}
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                ⚡ Quick Start (1-Click)
              </span>
              <div className="grid grid-cols-3 gap-2">
                {QUICK_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    disabled={creatingChat}
                    onClick={() => handleCreateCompanion(p.name, p.gender, p.emoji)}
                    className="p-2.5 rounded-2xl border border-slate-200 dark:border-teal-500/20 bg-slate-50 dark:bg-[#070c0b] hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-center transition-all cursor-pointer group"
                  >
                    <span className="block text-2xl mb-1 group-hover:scale-110 transition-transform">{p.emoji}</span>
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">{p.name}</span>
                    <span className="block text-[10px] text-slate-400 dark:text-slate-500 truncate">{p.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200 dark:bg-teal-500/15" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Or Customize
              </span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-teal-500/15" />
            </div>

            {createChatError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <span>⚠️</span>
                <span>{createChatError}</span>
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-3.5">
              {/* Profile Emoji & Name */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <button
                    type="button"
                    title="Change Emoji"
                    onClick={() => setShowModalEmojiPicker(!showModalEmojiPicker)}
                    className="w-12 h-12 rounded-2xl border-2 border-dashed border-teal-500/60 bg-slate-50 dark:bg-[#070c0b] flex items-center justify-center text-2xl shadow-xs cursor-pointer hover:scale-105 transition-transform shrink-0"
                  >
                    {newEmoji}
                  </button>
                  {showModalEmojiPicker && (
                    <div className="absolute top-full left-0 z-50 mt-2 shadow-2xl rounded-2xl overflow-hidden" ref={modalEmojiRef}>
                      <EmojiPicker
                        onEmojiClick={(e) => {
                          setNewEmoji(e.emoji);
                          setShowModalEmojiPicker(false);
                        }}
                        theme={theme === 'dark' ? 'dark' : 'light'}
                      />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1" htmlFor="modal-comp-name">
                    Companion Name
                  </label>
                  <input
                    id="modal-comp-name"
                    type="text"
                    placeholder="e.g. Priya, Arjun, Siri..."
                    value={newCompanionName}
                    onChange={(e) => setNewCompanionName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateCompanion()}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-teal-500/20 bg-slate-50/70 dark:bg-[#060a0a]/70 text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Companion's Gender */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Companion's Gender
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['female', 'male', 'other'].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setNewCompanionGender(g)}
                      className={`py-1.5 px-3 rounded-xl border text-xs font-semibold capitalize transition-all cursor-pointer ${
                        newCompanionGender === g
                          ? 'border-teal-500 bg-teal-500/15 text-teal-700 dark:text-teal-300 ring-1 ring-teal-500/40'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Context / Scenario */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Context / Vibe <span className="lowercase font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Best friend from college, talks casually in Telugu/Tanglish..."
                  value={newScenario}
                  onChange={(e) => setNewScenario(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-teal-500/20 bg-slate-50/70 dark:bg-[#060a0a]/70 text-slate-900 dark:text-white placeholder-slate-400 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowNewChatModal(false)}
                className="py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="create-new-chat-submit-btn"
                type="button"
                disabled={creatingChat}
                onClick={() => handleCreateCompanion()}
                className="py-2 px-5 rounded-xl bg-teal-600 hover:bg-teal-500 active:scale-[0.99] text-white text-xs sm:text-sm font-semibold shadow-md shadow-teal-600/20 transition-all cursor-pointer disabled:opacity-60 flex items-center gap-2"
              >
                {creatingChat ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Creating...</span>
                  </>
                ) : (
                  'Start Chatting →'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
