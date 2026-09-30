'use client';

import {
  PREFERENCE_COOKIE_MAX_AGE,
  THEME_COOKIE,
  THEME_COOKIE_LEGACY,
  THEME_STORAGE_KEY,
  THEME_STORAGE_KEY_LEGACY,
  writeCookieMigrating,
  writeStorageMigrating,
} from '@/lib/storefront-cookies';
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

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function writeTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
  writeStorageMigrating(localStorage, THEME_STORAGE_KEY, THEME_STORAGE_KEY_LEGACY, theme);
  writeCookieMigrating(THEME_COOKIE, THEME_COOKIE_LEGACY, theme, PREFERENCE_COOKIE_MAX_AGE);
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
export const THEME_INIT_SCRIPT = `(function(){try{var k='selfieface_theme';var legacy='lumea_theme';var m=document.cookie.match(/(?:^|; )selfieface_theme=([^;]+)/);var t=m?decodeURIComponent(m[1]):null;if(t!=='light'&&t!=='dark'){var lm=document.cookie.match(/(?:^|; )lumea_theme=([^;]+)/);t=lm?decodeURIComponent(lm[1]):null;}if(t!=='light'&&t!=='dark'){try{t=localStorage.getItem(k)||localStorage.getItem(legacy);}catch(e){t=null;}}if(t!=='light'&&t!=='dark')t='light';document.documentElement.classList.toggle('dark',t==='dark');document.documentElement.style.colorScheme=t;try{localStorage.setItem(k,t);localStorage.removeItem(legacy);}catch(e){}try{document.cookie=k+'='+encodeURIComponent(t)+'; path=/; max-age=31536000; SameSite=Lax';document.cookie=legacy+'=; path=/; max-age=0; SameSite=Lax';}catch(e){}}catch(e){}})();`;
