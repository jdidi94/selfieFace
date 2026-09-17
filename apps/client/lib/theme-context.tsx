'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Theme = 'light' | 'dark';

const COOKIE = 'lumea_theme';
const STORAGE_KEY = 'lumea_theme';

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function writeTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
  document.cookie = `${COOKIE}=${theme};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
}

export function ThemeProvider({
  children,
  initialTheme = 'light',
}: {
  children: ReactNode;
  initialTheme?: Theme;
}) {
  // Always seed from the server cookie so first client render matches SSR HTML.
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  useEffect(() => {
    // After mount, sync storage ↔ cookie without fighting hydration.
    writeTheme(initialTheme);
    try {
      localStorage.setItem(STORAGE_KEY, initialTheme);
    } catch {
      /* ignore */
    }
  }, [initialTheme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    writeTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      writeTheme(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}

/**
 * Runs before paint. Prefer the cookie (same source as RSC layout) so the DOM
 * matches SSR; fall back to localStorage only when the cookie is missing.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k='lumea_theme';var m=document.cookie.match(/(?:^|; )lumea_theme=([^;]+)/);var t=m?decodeURIComponent(m[1]):null;if(t!=='light'&&t!=='dark'){try{t=localStorage.getItem(k);}catch(e){t=null;}}if(t!=='light'&&t!=='dark')t='light';document.documentElement.classList.toggle('dark',t==='dark');document.documentElement.style.colorScheme=t;try{localStorage.setItem(k,t);}catch(e){}}catch(e){}})();`;
