import { create } from 'zustand';

export const useThemeStore = create((set) => {
  // Get initial theme from localStorage or default to 'dark'
  const savedTheme = localStorage.getItem('your-soul-theme');
  const initialTheme = savedTheme || 'dark';

  // Apply the theme to the document element immediately on load
  document.documentElement.setAttribute('data-theme', initialTheme);

  return {
    theme: initialTheme,
    toggleTheme: () => set((state) => {
      const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('your-soul-theme', nextTheme);
      document.documentElement.setAttribute('data-theme', nextTheme);
      return { theme: nextTheme };
    }),
    setTheme: (theme) => {
      localStorage.setItem('your-soul-theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
      set({ theme });
    }
  };
});
