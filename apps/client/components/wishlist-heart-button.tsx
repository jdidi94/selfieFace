'use client';

import { apiUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { UserType } from '@lumea/types';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import { Heart } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';

// All cards mounted together share one request; results are not cached after completion.
const wishlistRequests = new Map<string, Promise<string[]>>();
export function loadWishlistIds(accessToken: string): Promise<string[]> {
  const existing = wishlistRequests.get(accessToken);
  if (existing) return existing;
  const request = fetch(`${apiUrl}/wishlist/ids`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(20_000),
  }).then(async (res) => {
    if (!res.ok) throw new Error('Wishlist unavailable');
    return await res.json() as string[];
  }).finally(() => { wishlistRequests.delete(accessToken); });
  wishlistRequests.set(accessToken, request);
  return request;
}

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

  useEffect(() => {
    let active = true;
    if (!accessToken || user?.type !== UserType.CUSTOMER) {
      setSaved(false);
      return;
    }
    if (!loading) {
      void loadWishlistIds(accessToken).then((ids) => {
        if (active) setSaved(ids.includes(productId));
      }).catch(() => {});
    }
    return () => { active = false; };
  }, [accessToken, productId, user?.type, loading]);

  async function toggle(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user || user.type !== UserType.CUSTOMER || !accessToken) {
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
      aria-label={
        !user
          ? t.wishlistGuestCta
          : saved
            ? t.removeFromWishlist
            : t.addToWishlist
      }
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
        {t.wishlistGuestCta}
      </Link>
    </p>
  );
}
