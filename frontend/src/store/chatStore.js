import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useChatStore = create(
  persist(
    (set, get) => ({
      companions: [],
      activeCompanion: null,
      messages: [],
      isStreaming: false,
      streamingText: '',

      setCompanions: (companions) => set({ companions }),
      setActiveCompanion: (companion) => set({ activeCompanion: companion, messages: [] }),
      setMessages: (messages) => set({ messages }),

      removeCompanion: (companionId) => set((state) => ({
        companions: state.companions.filter((c) => c.id !== companionId),
        activeCompanion: state.activeCompanion?.id === companionId ? null : state.activeCompanion,
        messages: state.activeCompanion?.id === companionId ? [] : state.messages,
      })),

      addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),

      startStreaming: () => set({ isStreaming: true, streamingText: '' }),
      appendStreamChunk: (chunk) => set((state) => ({ streamingText: state.streamingText + chunk })),
      finishStreaming: () => {
        const { streamingText, messages } = get();
        if (streamingText) {
          set({
            messages: [...messages, { role: 'assistant', content: streamingText, id: Date.now(), created_at: new Date().toISOString() }],
            isStreaming: false,
            streamingText: '',
          });
        } else {
          // Stream ended with no text — still stop the spinner
          set({ isStreaming: false, streamingText: '' });
        }
      },
      cancelStreaming: () => set({ isStreaming: false, streamingText: '' }),

      clearHistory: () => set({ messages: [] }),
    }),
    {
      name: 'sathi-chat',
      partialize: (state) => ({
        activeCompanion: state.activeCompanion,
      }),
    }
  )
);
