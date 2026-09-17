'use client';

import { useEffect } from 'react';
import { getMessages } from '@/lib/messages';
import { THEME_INIT_SCRIPT } from '@/lib/theme-context';
import { Locale } from '@lumea/types';

function readLocale(): Locale {
  if (typeof document === 'undefined') return Locale.EN;
  const match = document.cookie.match(/(?:^|; )lumea_locale=([^;]+)/);
  const value = match?.[1] ? decodeURIComponent(match[1]) : '';
  if (value === Locale.AR) return Locale.AR;
  if (value === Locale.FR) return Locale.FR;
  return Locale.EN;
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const t = getMessages(readLocale());

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--background, #f7f4ef)',
          color: 'var(--foreground, #171512)',
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontSize: 28, fontWeight: 500 }}>Selfieface</h1>
          <p style={{ marginTop: 12, opacity: 0.7 }}>{t.errorPageBody}</p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 24,
              height: 40,
              padding: '0 16px',
              borderRadius: 6,
              border: 'none',
              background: 'var(--primary, #171512)',
              color: 'var(--primary-foreground, #f7f4ef)',
              cursor: 'pointer',
            }}
          >
            {t.errorRetry}
          </button>
        </div>
      </body>
    </html>
  );
}
