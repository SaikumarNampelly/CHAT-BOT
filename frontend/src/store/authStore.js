import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setAuth: (user, token) => {
        // Clear any stale companion state from a previous user session
        localStorage.removeItem('sathi-chat');
        set({ user, token, isAuthenticated: true });
      },

      logout: () => {
        // Clear stale companion state so old companion IDs don't cause 403s
        localStorage.removeItem('sathi-chat');
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    {
      name: 'sathi-auth',
    }
  )
);
