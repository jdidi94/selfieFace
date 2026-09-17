'use client';

import { apiUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import { Heart } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';

export function WishlistHeartButton({
  productId,
  className,
}: {
  productId: string;
  className?: string;
}) {
  const { user, accessToken, loading } = useAuth();
  const { locale } = useLocale();
  const t = getMessages(locale);
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !user) {
      setSaved(false);
      return;
    }
    const res = await fetch(`${apiUrl}/wishlist/ids`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return;
    const ids = (await res.json()) as string[];
    setSaved(ids.includes(productId));
  }, [accessToken, productId, user]);

  useEffect(() => {
    if (!loading) void load();
  }, [load, loading]);

  async function toggle(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user || !accessToken) {
      router.push(`/account/login?next=/wishlist`);
      return;
    }
    setPending(true);
    try {
      if (saved) {
        const res = await fetch(`${apiUrl}/wishlist/${productId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) setSaved(false);
      } else {
        const res = await fetch(`${apiUrl}/wishlist`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ productId }),
        });
        if (res.ok) setSaved(true);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      aria-label={saved ? t.removeFromWishlist : t.addToWishlist}
      disabled={pending}
      suppressHydrationWarning
      onClick={(e) => void toggle(e)}
      className={
        className ??
        'absolute end-3 top-3 z-10 rounded-full bg-background/90 p-2 text-foreground shadow-sm backdrop-blur transition hover:bg-background'
      }
    >
      <Heart className={`h-4 w-4 ${saved ? 'fill-primary text-primary' : ''}`} />
    </button>
  );
}

export function WishlistLoginHint() {
  const { locale } = useLocale();
  const t = getMessages(locale);

  return (
    <p className="text-sm text-muted-foreground">
      <Link href="/account/login?next=/wishlist" className="underline">
        {t.signIn}
      </Link>{' '}
      {t.wishlistSignInHint}
    </p>
  );
}
