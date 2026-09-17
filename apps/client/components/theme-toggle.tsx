'use client';

import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import { useTheme } from '@/lib/theme-context';
import { Button } from '@lumea/ui';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const { locale } = useLocale();
  const t = getMessages(locale);
  const isDark = theme === 'dark';

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      onClick={toggleTheme}
      aria-label={t.themeToggle}
      title={isDark ? t.themeLight : t.themeDark}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
