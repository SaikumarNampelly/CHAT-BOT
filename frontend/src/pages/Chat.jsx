import { Fragment, useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { streamMessage, streamGreet } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { useThemeStore } from '../store/themeStore';
import EmojiPicker from 'emoji-picker-react';
import AvatarSelector from '../components/AvatarSelector';
import { isImageAvatar } from '../utils/avatar';

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


export default function Chat() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const {
    companions, activeCompanion,
    messages, isStreaming, streamingText,
    setCompanions, setActiveCompanion, setMessages,
    addMessage, startStreaming, appendStreamChunk, finishStreaming,
    cancelStreaming, clearHistory, removeCompanion, updateCompanion,
  } = useChatStore();

  const [input, setInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [companionsLoaded, setCompanionsLoaded] = useState(false);
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
  const [newScenario, setNewScenario] = useState('');
  const [newEmoji, setNewEmoji] = useState('🌸');
  const [creatingChat, setCreatingChat] = useState(false);
  const [createChatError, setCreateChatError] = useState('');

  // Edit Companion Profile Modal state
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('🌸');
  const [editScenario, setEditScenario] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [editProfileError, setEditProfileError] = useState('');

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const searchInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const greetingTriggered = useRef({});

  // Close emoji picker on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
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
      .catch(() => {
        setActiveCompanion(null);
      })
      .finally(() => {
        setCompanionsLoaded(true);
      });
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
        companion_name: `${finalEmoji}|${finalGender}|other|${finalName}`,
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

  // Load chat history and trigger greeting if new
  useEffect(() => {
    if (!companionsLoaded || !activeCompanion?.id) return;
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
      } catch (err) {
        if (isMounted) {
          setMessages([]);
          if (err.response?.status === 403 || err.response?.status === 404) {
            setActiveCompanion(null);
          }
        }
      } finally {
        if (isMounted) setLoadingHistory(false);
      }
    };

    loadHistoryAndGreet();
    return () => { isMounted = false; };
  }, [companionsLoaded, activeCompanion?.id, appendStreamChunk, cancelStreaming, finishStreaming, setActiveCompanion, setMessages, startStreaming]);

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // Keep input focused automatically whenever streaming finishes or companion changes
  useEffect(() => {
    if (!isStreaming) {
      inputRef.current?.focus();
    }
  }, [isStreaming, activeCompanion?.id]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming || !activeCompanion) return;
    setInput('');
    setErrorMsg('');
    inputRef.current?.focus();
    addMessage({ role: 'user', content: text, id: Date.now(), created_at: new Date().toISOString() });
    startStreaming();
    streamMessage(
      { companionId: activeCompanion.id, message: text },
      (chunk) => appendStreamChunk(chunk),
      () => {
        finishStreaming();
        inputRef.current?.focus();
      },
      (err) => {
        console.error(err);
        setErrorMsg(err);
        cancelStreaming();
        inputRef.current?.focus();
      }
    );
  }, [input, isStreaming, activeCompanion, addMessage, appendStreamChunk, cancelStreaming, finishStreaming, startStreaming]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && input.trim()) {
        handleSend();
      }
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
      'from-[#643EF3] to-[#3A1ABB]',
      'from-[#4B8BFA] to-[#643EF3]',
      'from-[#23C4F0] to-[#4B8BFA]',
      'from-[#643EF3] to-[#AD55FB]',
      'from-[#F28FA3] to-[#643EF3]',
    ];
    return gradients[charCode % gradients.length];
  };

  const getAvatarChar = (name) => {
    if (!name) return '🌸';
    const parts = name.split('|');
    if (parts.length >= 2) return parts[0];
    return name[0]?.toUpperCase() || '🌸';
  };

  const renderAvatar = (rawName, sizeClass = "w-10 h-10 text-base", roundedClass = "rounded-full") => {
    const avatar = getAvatarChar(rawName);
    const isImg = isImageAvatar(avatar);

    if (isImg) {
      return (
        <img
          src={avatar}
          alt={getDispName(rawName) || 'Companion'}
          className={`${sizeClass} ${roundedClass} object-cover shrink-0 shadow-xs border border-white/20`}
        />
      );
    }

    return (
      <div className={`${sizeClass} ${roundedClass} bg-gradient-to-br ${getAvatarGradient(rawName)} flex items-center justify-center text-white font-semibold shadow-xs shrink-0 select-none`}>
        {avatar}
      </div>
    );
  };

  const handleOpenEditProfile = () => {
    if (!activeCompanion) return;
    setEditName(getDispName(activeCompanion.companion_name));
    setEditAvatar(getAvatarChar(activeCompanion.companion_name));
    setEditScenario(activeCompanion.scenario || '');
    setEditProfileError('');
    setShowEditProfileModal(true);
  };

  const handleSaveProfile = async () => {
    if (!activeCompanion) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditProfileError('Please enter a name for your companion.');
      return;
    }
    setSavingProfile(true);
    setEditProfileError('');

    try {
      const gender = getCompanionGender(activeCompanion.companion_name);
      const newCompanionNamePayload = `${editAvatar || '🌸'}|${gender}|other|${trimmed}`;
      const { data: updated } = await api.patch(`/companions/${activeCompanion.id}`, {
        companion_name: newCompanionNamePayload,
        scenario: editScenario.trim(),
      });

      updateCompanion(updated);
      setShowEditProfileModal(false);
    } catch (err) {
      console.error('Failed to update companion profile:', err);
      setEditProfileError(err.response?.data?.error || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const filteredCompanions = companions.filter((c) => {
    if (!searchQuery.trim()) return true;
    const displayName = getDispName(c.companion_name).toLowerCase();
    return displayName.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="relative flex h-screen h-dvh w-full bg-[#F8F7FC] text-[#171533] dark:bg-[#0C0A1B] dark:text-[#F4F3FA] overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-30 md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ============ SIDEBAR ============ */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-80 md:w-80 flex flex-col bg-white/95 dark:bg-[#141228]/95 border-r border-[#E7E5F0] dark:border-[#262247] backdrop-blur-xl transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand & New Chat */}
        <div className="p-4 border-b border-[#E7E5F0] dark:border-[#262247] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img
                src="/talkmate-icon.png"
                alt="TalkMate"
                className="w-8 h-8 rounded-xl object-cover shadow-sm ring-1 ring-[#171533]/5 dark:ring-white/10"
              />
              <div>
                <span className="block font-bold text-sm tracking-tight text-[#171533] dark:text-[#F4F3FA] leading-tight">
                  Talk<span className="text-[#643EF3] dark:text-[#8D6BFF]">Mate</span>
                </span>
                <span className="block text-[10px] text-[#68657D] dark:text-[#9E9AB3] font-medium tracking-wide">Feel the connection</span>
              </div>
            </div>

            <button
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-1.5 rounded-lg text-[#68657D] hover:text-[#171533] dark:hover:text-[#F4F3FA] cursor-pointer"
            >
              ✕
            </button>
          </div>

          <button
            id="new-companion-btn"
            onClick={() => setShowNewChatModal(true)}
            className="w-full py-2.5 px-4 rounded-xl bg-[#643EF3] hover:bg-[#3A1ABB] active:bg-[#3A1ABB] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-md shadow-[#643EF3]/20 transition-all cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Chat
          </button>

          {/* Search bar with shortcut */}
          <div className="relative flex items-center">
            <svg className="absolute left-3 w-3.5 h-3.5 text-[#68657D] dark:text-[#9E9AB3] pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-16 py-1.5 rounded-xl border border-[#E7E5F0] dark:border-[#262247] bg-[#F8F7FC] dark:bg-[#0C0A1B] text-xs text-[#171533] dark:text-[#F4F3FA] placeholder-[#68657D]/60 focus:outline-none focus:ring-1 focus:ring-[#643EF3] transition-all"
            />
            <span className="absolute right-2 px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#F1EEFF] dark:bg-[#1E1A3C] text-[#643EF3] dark:text-[#8D6BFF] border border-[#E7E5F0] dark:border-[#262247] pointer-events-none">
              Ctrl+K
            </span>
          </div>
        </div>

        {/* Section Heading */}
        <div className="px-4 py-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#68657D] dark:text-[#9E9AB3]">
          <span>Chats</span>
          <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-[#F1EEFF] dark:bg-[#1E1A3C] text-[#643EF3] dark:text-[#8D6BFF]">
            {filteredCompanions.length}
          </span>
        </div>

        {/* Companion List */}
        <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1">
          {filteredCompanions.length === 0 && (
            <div className="text-center py-10 px-4 text-xs text-[#68657D] dark:text-[#9E9AB3] whitespace-pre-line leading-relaxed">
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
                    ? 'bg-[#F1EEFF] dark:bg-[#1E1A3C] border border-[#643EF3]/30 text-[#171533] dark:text-[#F4F3FA] shadow-xs'
                    : 'hover:bg-[#F8F7FC] dark:hover:bg-[#141228]/80 text-[#171533] dark:text-[#F4F3FA] border border-transparent'
                }`}
              >
                {/* Avatar */}
                {renderAvatar(c.companion_name, "w-10 h-10 text-base")}

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs sm:text-sm truncate text-[#171533] dark:text-[#F4F3FA]">
                      {getDispName(c.companion_name)}
                    </span>
                    <span className="text-[10px] text-[#68657D] dark:text-[#9E9AB3] shrink-0">
                      01:32 PM
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#23C4F0] inline-block shrink-0 animate-pulse"></span>
                    <span className="text-[11px] text-[#68657D] dark:text-[#9E9AB3] truncate">
                      Online • {getCompanionGender(c.companion_name)}
                    </span>
                  </div>
                </div>

                {/* Delete button */}
                <button
                  type="button"
                  title="Delete companion"
                  onClick={(e) => handleDeleteCompanion(e, c.id, c.companion_name)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[#68657D] hover:text-[#E4586E] hover:bg-[#E4586E]/10 transition-all shrink-0 cursor-pointer"
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
        <div className="p-3 border-t border-[#E7E5F0] dark:border-[#262247] flex items-center justify-between gap-2 bg-[#F8F7FC]/70 dark:bg-[#141228]/70">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#643EF3] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
              {getAvatarChar(user?.name)}
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-semibold text-[#171533] dark:text-[#F4F3FA] truncate">{user?.name || 'User'}</span>
              <span className="flex items-center gap-1 text-[10px] text-[#68657D] dark:text-[#9E9AB3]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#23C4F0]"></span> Online
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleTheme}
              title="Toggle theme"
              className="p-2 rounded-xl text-[#68657D] dark:text-[#9E9AB3] hover:bg-[#F1EEFF] dark:hover:bg-[#1E1A3C] hover:text-[#643EF3] dark:hover:text-[#8D6BFF] transition-colors cursor-pointer"
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
              className="p-2 rounded-xl text-[#68657D] dark:text-[#9E9AB3] hover:text-[#E4586E] hover:bg-[#E4586E]/10 transition-colors cursor-pointer"
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
      <section className="flex-1 flex flex-col h-full min-w-0 bg-[#F8F7FC]/90 dark:bg-[#0C0A1B]/90 backdrop-blur-[2px] relative">
        {!activeCompanion ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="relative mb-4">
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#23C4F0] via-[#4B8BFA] to-[#643EF3] opacity-30 blur-lg"></div>
              <img
                src="/talkmate-icon.png"
                alt="TalkMate"
                className="relative w-20 h-20 rounded-3xl object-cover shadow-xl border border-white/40 dark:border-white/10"
              />
            </div>
            <h2 className="text-2xl font-bold text-[#171533] dark:text-[#F4F3FA]">
              Welcome to Talk<span className="text-[#643EF3] dark:text-[#8D6BFA]">Mate</span>
            </h2>
            <p className="text-sm text-[#68657D] dark:text-[#A09DB8] max-w-sm mt-2 mb-6">
              Connect with your personal companion. Pick a chat from the sidebar or start fresh.
            </p>
            <div className="flex items-center justify-center">
              <button
                id="customize-new-chat-btn"
                type="button"
                onClick={() => setShowNewChatModal(true)}
                className="py-2.5 px-6 rounded-xl bg-[#643EF3] hover:bg-[#3A1ABB] active:scale-[0.99] text-white font-semibold text-sm shadow-md shadow-[#643EF3]/25 transition-all cursor-pointer flex items-center gap-2"
              >
                <span>💬</span>
                <span>Start New Chat</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Top Header */}
            <header className="h-16 px-4 sm:px-6 border-b border-[#E7E5F0] dark:border-[#26214B] bg-white/95 dark:bg-[#141228]/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 z-10">
              <div className="flex items-center gap-3 min-w-0">
                {/* Mobile sidebar toggle button */}
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(true)}
                  aria-label="Open menu"
                  className="md:hidden p-1.5 rounded-lg text-[#68657D] dark:text-[#A09DB8] hover:bg-[#F1EEFF] dark:hover:bg-[#1E1B38] hover:text-[#643EF3]"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                </button>

                {/* Clickable Profile Avatar & Name (opens Edit Profile Modal) */}
                <div
                  onClick={handleOpenEditProfile}
                  title="Click to edit picture or name"
                  className="flex items-center gap-3 min-w-0 cursor-pointer p-1 -m-1 rounded-2xl hover:bg-[#F8F7FC] dark:hover:bg-[#1E1A3C]/60 transition-colors group"
                >
                  <div className="relative shrink-0">
                    {renderAvatar(activeCompanion.companion_name, "w-10 h-10 text-base")}
                    <div className="absolute inset-0 rounded-full bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity shadow-sm">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-bold text-sm sm:text-base text-[#171533] dark:text-[#F4F3FA] truncate">
                      <span>{getDispName(activeCompanion.companion_name)}</span>
                      <svg className="w-3.5 h-3.5 text-[#68657D] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-[#68657D] dark:text-[#A09DB8]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#23C4F0] shrink-0"></span>
                      <span className="truncate">Online • {getCompanionGender(activeCompanion.companion_name)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  title="Voice call"
                  onClick={() => alert(`Starting voice call with ${getDispName(activeCompanion.companion_name)}...`)}
                  className="p-2 sm:p-2.5 rounded-full text-[#68657D] dark:text-[#A09DB8] hover:bg-[#F1EEFF] dark:hover:bg-[#1E1B38] hover:text-[#643EF3] transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </button>

                <button
                  type="button"
                  title="Video call"
                  onClick={() => alert(`Starting video call with ${getDispName(activeCompanion.companion_name)}...`)}
                  className="p-2 sm:p-2.5 rounded-full text-[#68657D] dark:text-[#A09DB8] hover:bg-[#F1EEFF] dark:hover:bg-[#1E1B38] hover:text-[#643EF3] transition-colors cursor-pointer"
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
                  className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl border border-[#E7E5F0] dark:border-[#26214B] text-xs font-semibold text-[#68657D] dark:text-[#A09DB8] hover:text-[#E4586E] dark:hover:text-[#F28FA3] hover:border-[#E4586E]/40 transition-colors cursor-pointer"
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
                    <div className="w-8 h-8 rounded-full bg-[#E7E5F0] dark:bg-[#201C3E]" />
                    <div className="h-12 w-48 rounded-2xl bg-[#E7E5F0] dark:bg-[#201C3E]" />
                  </div>
                  <div className="flex items-start gap-2.5 max-w-xs ml-auto flex-row-reverse animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-[#E7E5F0] dark:bg-[#201C3E]" />
                    <div className="h-10 w-40 rounded-2xl bg-[#E7E5F0] dark:bg-[#201C3E]" />
                  </div>
                </div>
              )}

              {!loadingHistory && messages.length === 0 && !isStreaming && (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  {renderAvatar(activeCompanion.companion_name, "w-16 h-16 text-2xl", "rounded-3xl shadow-lg mb-3")}
                  <h3 className="font-bold text-base text-[#171533] dark:text-[#F4F3FA]">
                    {getDispName(activeCompanion.companion_name)} is waiting...
                  </h3>
                  <p className="text-xs sm:text-sm text-[#68657D] dark:text-[#A09DB8] mt-1">
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
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-[#F1EEFF] dark:bg-[#1E1A3C] text-[#643EF3] dark:text-[#AD55FB] border border-[#E7E5F0] dark:border-[#643EF3]/25 shadow-2xs">
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
                        {msg.role === 'assistant' && renderAvatar(activeCompanion.companion_name, "w-7 h-7 text-xs", "rounded-full mb-1")}

                        <div className="flex flex-col max-w-[85%] sm:max-w-[70%]">
                          <div
                            className={`p-3 sm:p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words ${
                              msg.role === 'user'
                                ? 'bg-[#643EF3] text-white rounded-br-xs shadow-md shadow-[#643EF3]/20'
                                : 'bg-white dark:bg-[#141228] text-[#171533] dark:text-[#F4F3FA] rounded-bl-xs border border-[#E7E5F0] dark:border-[#26214B] shadow-xs'
                            }`}
                          >
                            {msg.content}
                          </div>

                          <div className={`flex items-center gap-1.5 mt-1 px-1 text-[10px] text-[#68657D]/80 dark:text-[#A09DB8]/80 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <span>{timeStr(msg.created_at)}</span>
                            {msg.role === 'user' && (
                              <span title="Delivered & read" className="text-[#4B8BFA] dark:text-[#23C4F0]">
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="18 6 9 17 4 12" />
                                  <polyline points="22 10 13 21 11 19" />
                                </svg>
                              </span>
                            )}
                          </div>
                        </div>

                        {msg.role === 'user' && (
                          <div className="w-7 h-7 rounded-full bg-[#643EF3] text-white text-xs font-bold flex items-center justify-center shrink-0 mb-1 shadow-xs">
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
                  {renderAvatar(activeCompanion.companion_name, "w-7 h-7 text-xs", "rounded-full mb-1")}
                  <div className="p-3 sm:p-3.5 rounded-2xl rounded-bl-xs bg-white dark:bg-[#141228] border border-[#E7E5F0] dark:border-[#26214B] text-xs sm:text-sm text-[#171533] dark:text-[#F4F3FA] shadow-xs">
                    {streamingText ? (
                      <>
                        <span>{streamingText}</span>
                        <span className="inline-block opacity-70 animate-pulse ml-0.5">▌</span>
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5 py-1 px-1">
                        <span className="w-2 h-2 rounded-full bg-[#23C4F0] animate-bounce"></span>
                        <span className="w-2 h-2 rounded-full bg-[#23C4F0] animate-bounce [animation-delay:0.15s]"></span>
                        <span className="w-2 h-2 rounded-full bg-[#23C4F0] animate-bounce [animation-delay:0.3s]"></span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {errorMsg && (
              <div className="mx-4 mb-2 p-2.5 rounded-xl bg-[#E4586E]/10 border border-[#E4586E]/30 text-[#E4586E] dark:text-[#F28FA3] text-xs flex items-center justify-between">
                <span>⚠️ {errorMsg}</span>
                <button onClick={() => setErrorMsg('')} className="font-bold text-sm px-2 cursor-pointer">×</button>
              </div>
            )}

            {/* Input Composer */}
            <footer className="p-3 sm:p-4 bg-white/95 dark:bg-[#141228]/95 border-t border-[#E7E5F0] dark:border-[#26214B] backdrop-blur-md flex items-center gap-2">
              <div
                onClick={() => inputRef.current?.focus()}
                className="relative flex-1 flex items-center bg-[#F8F7FC] dark:bg-[#0C0A1B] border border-[#E7E5F0] dark:border-[#26214B] focus-within:border-[#643EF3] focus-within:ring-2 focus-within:ring-[#643EF3]/20 rounded-full px-3 py-1.5 shadow-xs transition-all cursor-text"
              >
                {/* Emoji button */}
                <button
                  type="button"
                  title="Emoji"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowEmojiPicker(!showEmojiPicker);
                  }}
                  className="p-1 text-[#68657D] dark:text-[#A09DB8] hover:text-[#643EF3] dark:hover:text-[#AD55FB] transition-colors cursor-pointer shrink-0"
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
                      onEmojiClick={(emoji) => {
                        setInput(prev => prev + emoji.emoji);
                        inputRef.current?.focus();
                      }}
                      theme={theme === 'dark' ? 'dark' : 'light'}
                    />
                  </div>
                )}

                <input
                  ref={inputRef}
                  id="message-input"
                  type="text"
                  placeholder={isStreaming ? "Thinking..." : "Type a message..."}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  autoComplete="off"
                  autoFocus
                  className="flex-1 bg-transparent px-2.5 py-1 text-xs sm:text-sm text-[#171533] dark:text-[#F4F3FA] placeholder-[#68657D]/60 dark:placeholder-[#A09DB8]/60 focus:outline-none"
                />
              </div>

              {/* Attachment button */}
              <button
                type="button"
                title="Attach file"
                onClick={() => alert('Attachment feature coming soon!')}
                className="w-10 h-10 rounded-full border border-[#E7E5F0] dark:border-[#26214B] bg-[#F8F7FC] dark:bg-[#141228] text-[#68657D] dark:text-[#A09DB8] flex items-center justify-center hover:bg-[#F1EEFF] dark:hover:bg-[#1E1B38] hover:text-[#643EF3] transition-all cursor-pointer shrink-0"
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
                    ? 'border-[#E4586E] bg-[#E4586E]/15 text-[#E4586E] ring-2 ring-[#E4586E]/40 animate-voice-pulse'
                    : 'border-[#E7E5F0] dark:border-[#26214B] bg-[#F8F7FC] dark:bg-[#141228] text-[#68657D] dark:text-[#A09DB8] hover:bg-[#F1EEFF] dark:hover:bg-[#1E1B38] hover:text-[#643EF3]'
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
                onClick={() => {
                  handleSend();
                  inputRef.current?.focus();
                }}
                disabled={isStreaming || !input.trim()}
                aria-label="Send"
                className="w-10 h-10 rounded-full bg-[#643EF3] hover:bg-[#3A1ABB] active:scale-95 text-white flex items-center justify-center shadow-md shadow-[#643EF3]/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0"
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
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#141228] border border-[#E7E5F0] dark:border-[#26214B] p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-base text-[#171533] dark:text-[#F4F3FA]">
              {modalConfig.title}
            </h3>
            <p className="text-xs sm:text-sm text-[#68657D] dark:text-[#A09DB8] leading-relaxed">
              {modalConfig.description}
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setModalConfig(null)}
                className="py-2 px-4 rounded-xl border border-[#E7E5F0] dark:border-[#26214B] text-xs font-semibold text-[#68657D] dark:text-[#A09DB8] hover:bg-[#F1EEFF] dark:hover:bg-[#1E1B38] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  modalConfig.onConfirm();
                  setModalConfig(null);
                }}
                className="py-2 px-4 rounded-xl bg-[#E4586E] hover:bg-[#c9455a] text-white text-xs font-semibold shadow-md shadow-[#E4586E]/20 transition-all cursor-pointer"
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
            className="w-full max-w-md rounded-3xl bg-white dark:bg-[#141228] border border-[#E7E5F0] dark:border-[#26214B] p-6 sm:p-7 shadow-2xl space-y-4 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E7E5F0] dark:border-[#26214B] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#F1EEFF] dark:bg-[#1E1A3C] border border-[#643EF3]/30 flex items-center justify-center text-[#643EF3] dark:text-[#AD55FB] text-lg">
                  💬
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#171533] dark:text-[#F4F3FA]">
                    Start a New Chat
                  </h3>
                  <p className="text-[11px] text-[#68657D] dark:text-[#A09DB8]">
                    Customize your personal companion
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNewChatModal(false)}
                className="p-1.5 rounded-lg text-[#68657D] hover:text-[#171533] dark:hover:text-[#F4F3FA] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {createChatError && (
              <div className="p-3 rounded-xl bg-[#E4586E]/10 border border-[#E4586E]/30 text-[#E4586E] dark:text-[#F28FA3] text-xs flex items-center gap-2">
                <span>⚠️</span>
                <span>{createChatError}</span>
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-3.5">
              {/* Profile Avatar (Emoji, Upload Photo) */}
              <AvatarSelector
                value={newEmoji}
                onChange={setNewEmoji}
                companionName={newCompanionName}
              />

              {/* Name */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#68657D] dark:text-[#A09DB8] mb-1" htmlFor="modal-comp-name">
                  Companion Name
                </label>
                <input
                  id="modal-comp-name"
                  type="text"
                  placeholder="e.g. Maya, Alex, Sam..."
                  value={newCompanionName}
                  onChange={(e) => setNewCompanionName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateCompanion()}
                  className="w-full px-3 py-2 rounded-xl border border-[#E7E5F0] dark:border-[#26214B] bg-[#F8F7FC] dark:bg-[#0C0A1B] text-[#171533] dark:text-[#F4F3FA] placeholder-[#68657D]/60 text-xs sm:text-sm focus:outline-none focus:border-[#643EF3] focus:ring-2 focus:ring-[#643EF3]/20"
                />
              </div>

              {/* Companion's Gender */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#68657D] dark:text-[#A09DB8] mb-1.5">
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
                          ? 'border-[#643EF3] bg-[#F1EEFF] dark:bg-[#1E1A3C] text-[#643EF3] dark:text-[#AD55FB] ring-1 ring-[#643EF3]/40'
                          : 'border-[#E7E5F0] dark:border-[#26214B] text-[#68657D] dark:text-[#A09DB8] hover:border-[#643EF3]/40'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Context / Scenario */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#68657D] dark:text-[#A09DB8] mb-1">
                  Context / Vibe <span className="lowercase font-normal text-[#68657D]/70">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Best friend from college, talks casually in Telugu/Tanglish..."
                  value={newScenario}
                  onChange={(e) => setNewScenario(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#E7E5F0] dark:border-[#26214B] bg-[#F8F7FC] dark:bg-[#0C0A1B] text-[#171533] dark:text-[#F4F3FA] placeholder-[#68657D]/60 text-xs focus:outline-none focus:border-[#643EF3] focus:ring-2 focus:ring-[#643EF3]/20 resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowNewChatModal(false)}
                className="py-2 px-4 rounded-xl border border-[#E7E5F0] dark:border-[#26214B] text-xs font-semibold text-[#68657D] dark:text-[#A09DB8] hover:bg-[#F1EEFF] dark:hover:bg-[#1E1B38] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="create-new-chat-submit-btn"
                type="button"
                disabled={creatingChat}
                onClick={() => handleCreateCompanion()}
                className="py-2 px-5 rounded-xl bg-[#643EF3] hover:bg-[#3A1ABB] active:scale-[0.99] text-white text-xs sm:text-sm font-semibold shadow-md shadow-[#643EF3]/25 transition-all cursor-pointer disabled:opacity-60 flex items-center gap-2"
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

      {/* ============ EDIT COMPANION PROFILE MODAL ============ */}
      {showEditProfileModal && activeCompanion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
          onClick={() => setShowEditProfileModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white dark:bg-[#141228] border border-[#E7E5F0] dark:border-[#26214B] p-6 sm:p-7 shadow-2xl space-y-4 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E7E5F0] dark:border-[#26214B] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#F1EEFF] dark:bg-[#1E1A3C] border border-[#643EF3]/30 flex items-center justify-center text-[#643EF3] dark:text-[#AD55FB] text-lg">
                  ✏️
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#171533] dark:text-[#F4F3FA]">
                    Edit Profile & Picture
                  </h3>
                  <p className="text-[11px] text-[#68657D] dark:text-[#A09DB8]">
                    Change photo, emoji, or companion details
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditProfileModal(false)}
                className="p-1.5 rounded-lg text-[#68657D] hover:text-[#171533] dark:hover:text-[#F4F3FA] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {editProfileError && (
              <div className="p-3 rounded-xl bg-[#E4586E]/10 border border-[#E4586E]/30 text-[#E4586E] dark:text-[#F28FA3] text-xs flex items-center gap-2">
                <span>⚠️</span>
                <span>{editProfileError}</span>
              </div>
            )}

            {/* Profile Avatar Selector (Emoji, Upload Photo) */}
            <AvatarSelector
              value={editAvatar}
              onChange={setEditAvatar}
              companionName={editName}
            />

            {/* Name */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#68657D] dark:text-[#A09DB8] mb-1">
                Companion Name
              </label>
              <input
                type="text"
                placeholder="e.g. Priya, Maya..."
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveProfile()}
                className="w-full px-3 py-2 rounded-xl border border-[#E7E5F0] dark:border-[#26214B] bg-[#F8F7FC] dark:bg-[#0C0A1B] text-[#171533] dark:text-[#F4F3FA] placeholder-[#68657D]/60 text-xs sm:text-sm focus:outline-none focus:border-[#643EF3] focus:ring-2 focus:ring-[#643EF3]/20"
              />
            </div>

            {/* Scenario */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#68657D] dark:text-[#A09DB8] mb-1">
                Context / Vibe <span className="lowercase font-normal text-[#68657D]/70">(optional)</span>
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Best friend from college, talks casually..."
                value={editScenario}
                onChange={(e) => setEditScenario(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-[#E7E5F0] dark:border-[#26214B] bg-[#F8F7FC] dark:bg-[#0C0A1B] text-[#171533] dark:text-[#F4F3FA] placeholder-[#68657D]/60 text-xs focus:outline-none focus:border-[#643EF3] focus:ring-2 focus:ring-[#643EF3]/20 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E7E5F0] dark:border-[#26214B]">
              <button
                type="button"
                onClick={() => setShowEditProfileModal(false)}
                className="py-2 px-4 rounded-xl border border-[#E7E5F0] dark:border-[#26214B] text-xs font-semibold text-[#68657D] dark:text-[#A09DB8] hover:bg-[#F1EEFF] dark:hover:bg-[#1E1B38] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingProfile}
                onClick={handleSaveProfile}
                className="py-2 px-5 rounded-xl bg-[#643EF3] hover:bg-[#3A1ABB] active:scale-[0.99] text-white text-xs sm:text-sm font-semibold shadow-md shadow-[#643EF3]/25 transition-all cursor-pointer disabled:opacity-60 flex items-center gap-2"
              >
                {savingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
