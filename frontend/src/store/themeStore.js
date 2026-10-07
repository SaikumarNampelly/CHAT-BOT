import { create } from 'zustand';

export const useThemeStore = create((set, get) => {
  // Get initial theme from localStorage or default to 'dark'
  const savedTheme = typeof window !== 'undefined' ? (localStorage.getItem('talkmate-theme') || localStorage.getItem('your-soul-theme')) : null;
  const initialTheme = savedTheme || 'dark';

  // Apply the theme to the document element immediately on initial script execution
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', initialTheme);
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');
  }

  let transitionTimer = null;
  let finishTimer = null;

  return {
    theme: initialTheme,
    isTransitioning: false,
    targetTheme: null,

    toggleTheme: () => {
      const { theme, isTransitioning } = get();

      // Guard: prevent overlapping transitions if clicked rapidly
      if (isTransitioning) return;

      const nextTheme = theme === 'dark' ? 'light' : 'dark';

      // Accessibility: respect prefers-reduced-motion
      if (
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        localStorage.setItem('talkmate-theme', nextTheme);
        document.documentElement.setAttribute('data-theme', nextTheme);
        document.documentElement.classList.toggle('dark', nextTheme === 'dark');
        set({ theme: nextTheme, isTransitioning: false, targetTheme: null });
        return;
      }

      // Clear any pending timers
      if (transitionTimer) clearTimeout(transitionTimer);
      if (finishTimer) clearTimeout(finishTimer);

      // 1. Mount Token Cascade overlay in destination theme visual language
      set({ isTransitioning: true, targetTheme: nextTheme });

      // 2. Switch the underlying theme at ~240ms while overlay is fully covering the UI
      transitionTimer = setTimeout(() => {
        localStorage.setItem('talkmate-theme', nextTheme);
        document.documentElement.setAttribute('data-theme', nextTheme);
        document.documentElement.classList.toggle('dark', nextTheme === 'dark');
        set({ theme: nextTheme });
      }, 240);

      // 3. Complete transition at 500ms and unmount overlay cleanly
      finishTimer = setTimeout(() => {
        set({ isTransitioning: false, targetTheme: null });
      }, 500);
    },

    setTheme: (theme) => {
      localStorage.setItem('talkmate-theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.classList.toggle('dark', theme === 'dark');
      set({ theme, isTransitioning: false, targetTheme: null });
    },
  };
});
