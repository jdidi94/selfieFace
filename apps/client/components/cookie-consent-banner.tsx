'use client';

import { fetchApi } from '@/lib/api';
import { Button, cn } from '@lumea/ui';
import {
  COOKIE_CONSENT_REOPEN_EVENT,
  getCookieConsent,
  setCookieConsent,
} from '@/lib/cookie-consent';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import { useCurrency } from '@/lib/currency-context';
import type { LegalDocumentDto } from '@lumea/types';
import { useEffect, useState } from 'react';

export function CookieConsentBanner() {
  const { locale } = useLocale();
  const { currency } = useCurrency();
  const t = getMessages(locale);
  const [visible, setVisible] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [document, setDocument] = useState<LegalDocumentDto | null>(null);

  useEffect(() => {
    setVisible(getCookieConsent() === null);

    function onReopen() {
      setVisible(true);
    }
    window.addEventListener(COOKIE_CONSENT_REOPEN_EVENT, onReopen);
    return () => window.removeEventListener(COOKIE_CONSENT_REOPEN_EVENT, onReopen);
  }, []);

  if (!visible) return null;

  function choose(choice: 'all' | 'essential') {
    setCookieConsent(choice);
    setVisible(false);
  }

  async function toggleDetails() {
    if (detailsOpen) {
      setDetailsOpen(false);
      return;
    }
    setDetailsOpen(true);
    if (document || detailsLoading) return;
    setDetailsLoading(true);
    try {
      setDocument(
        await fetchApi<LegalDocumentDto>(
          `/content/legal?slug=cookies&locale=${locale}&currency=${currency}`,
        ),
      );
    } finally {
      setDetailsLoading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-body"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 p-4 shadow-lg backdrop-blur-sm md:p-5"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl space-y-2">
          <p id="cookie-consent-title" className="text-sm font-medium text-foreground">
            {t.cookieConsentTitle}
          </p>
          <p id="cookie-consent-body" className="text-sm text-muted-foreground">
            {t.cookieConsentBody}{' '}
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => void toggleDetails()}
              aria-expanded={detailsOpen}
            >
              {t.cookieConsentLegalLink}
            </button>
          </p>
          {detailsOpen ? (
            <div className="rounded-md border border-border bg-surface p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{document?.title ?? t.cookieConsentManage}</p>
              <p className="mt-1 whitespace-pre-line">
                {detailsLoading ? t.loading : document?.content ?? t.cookieConsentBody}
              </p>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-w-[8rem]"
            onClick={() => choose('essential')}
          >
            {t.cookieConsentEssentialOnly}
          </Button>
          <Button
            type="button"
            className={cn('min-w-[8rem]')}
            onClick={() => choose('all')}
          >
            {t.cookieConsentAcceptAll}
          </Button>
          <button
            type="button"
            className="text-sm text-muted-foreground underline underline-offset-2 md:ms-1"
            onClick={() => void toggleDetails()}
            aria-expanded={detailsOpen}
          >
            {t.cookieConsentManage}
          </button>
        </div>
      </div>
    </div>
  );
}
