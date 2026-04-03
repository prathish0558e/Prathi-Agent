export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'career_agent_theme';

const isValidTheme = (value: string | null): value is ThemeMode => {
  return value === 'light' || value === 'dark' || value === 'system';
};

export const getStoredTheme = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'system';
  }

  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isValidTheme(saved) ? saved : 'system';
};

export const setStoredTheme = (mode: ThemeMode) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(THEME_STORAGE_KEY, mode);
};

const resolveTheme = (mode: ThemeMode): 'light' | 'dark' => {
  if (mode !== 'system') {
    return mode;
  }

  if (typeof window === 'undefined') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const applyTheme = (mode: ThemeMode) => {
  if (typeof document === 'undefined') {
    return;
  }

  const resolved = resolveTheme(mode);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
};

export const syncStoredTheme = () => {
  applyTheme(getStoredTheme());
};
