import { useState, useEffect } from 'react';

const THEME_KEY = 'motogo-theme';
const listeners = new Set();
let currentTheme = (() => {
  try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch { return 'auto'; }
})();

function getSystemDark() {
  return typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
}

function applyTheme(theme) {
  const isDark = theme === 'dark' || (theme === 'auto' && getSystemDark());
  document.documentElement.classList.toggle('dark', isDark);
}

function setTheme(theme) {
  currentTheme = theme;
  try { localStorage.setItem(THEME_KEY, theme); } catch {}
  applyTheme(theme);
  listeners.forEach((l) => l(theme));
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Apply on module load to stay in sync as early as possible
applyTheme(currentTheme);

export function useTheme() {
  const [theme, setThemeState] = useState(currentTheme);

  useEffect(() => subscribe(setThemeState), []);

  useEffect(() => {
    if (theme !== 'auto' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('auto');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return { theme, setTheme };
}