'use client';

import { Button } from '@lumea/ui';
import { useState } from 'react';

type ProductShareButtonsProps = {
  title: string;
  url?: string;
  text?: string;
  shareLabel?: string;
  copyLabel?: string;
  copiedLabel?: string;
};

export function ProductShareButtons({
  title,
  url,
  text,
  shareLabel = 'Share',
  copyLabel = 'Copy link',
  copiedLabel = 'Copied',
}: ProductShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const shareUrl = url ?? (typeof window !== 'undefined' ? window.location.href : '');
    const payload = {
      title,
      text: text ?? title,
      url: shareUrl,
    };

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(payload);
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }

    await copyLink(shareUrl);
  }

  async function copyLink(shareUrl?: string) {
    const value =
      shareUrl ?? url ?? (typeof window !== 'undefined' ? window.location.href : '');
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => void share()}>
        {shareLabel}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => void copyLink()}>
        {copied ? copiedLabel : copyLabel}
      </Button>
    </div>
  );
}
