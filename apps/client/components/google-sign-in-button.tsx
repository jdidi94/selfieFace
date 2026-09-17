'use client';

import { Button } from '@lumea/ui';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';

export function GoogleSignInButton() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
  const { locale } = useLocale();
  const t = getMessages(locale);

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={() => {
        window.location.href = `${apiUrl}/auth/google`;
      }}
    >
      {t.continueWithGoogle}
    </Button>
  );
}
