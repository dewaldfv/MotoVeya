import { createContext, useState, useEffect, useContext, useCallback } from 'react';

const SettingsContext = createContext(null);

const STORAGE_KEY_THEME = 'motogo_theme';
const STORAGE_KEY_ORIENTATION = 'motogo_orientation';

export function AppSettingsProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY_THEME) || 'auto'; } catch { return 'auto'; }
  });
  const [orientation, setOrientationState] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY_ORIENTATION) || 'auto'; } catch { return 'auto'; }
  });

  const applyTheme = useCallback((t) => {
    const isDark = t === 'dark' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    if (theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('auto');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme, applyTheme]);

  const setTheme = (t) => {
    setThemeState(t);
    try { localStorage.setItem(STORAGE_KEY_THEME, t); } catch {}
  };

  const setOrientation = (o) => {
    setOrientationState(o);
    try { localStorage.setItem(STORAGE_KEY_ORIENTATION, o); } catch {}
    try {
      if (o === 'auto') {
        screen.orientation?.unlock?.();
      } else {
        screen.orientation?.lock?.(o).catch(() => {});
      }
    } catch {}
  };

  return (
    <SettingsContext.Provider value={{ theme, setTheme, orientation, setOrientation }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useAppSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useAppSettings must be used within AppSettingsProvider');
  return ctx;
}