'use client';

import { trackSearch } from '@/lib/behavior';
import type { Locale } from '@lumea/types';
import { useEffect, useRef } from 'react';

/** Records a SEARCH behavior event once when the shop loads with a non-empty `q`. */
export function SearchBehaviorBeacon({
  query,
  locale,
}: {
  query: string;
  locale: Locale;
}) {
  const sent = useRef(false);
  useEffect(() => {
    const q = query.trim();
    if (!q || sent.current) return;
    sent.current = true;
    trackSearch(q, locale, '/shop');
  }, [query, locale]);
  return null;
}
