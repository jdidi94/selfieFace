'use client';

import { mediaUrl } from '@/lib/api';
import type { JournalArticleImageDto } from '@lumea/types';
import type { ReactNode } from 'react';

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;
const INLINE_RE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;

function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.replace(/^\//, '').split('/')[0] || null;
    }
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname.startsWith('/embed/')) {
        return u.pathname.split('/')[2] || null;
      }
      if (u.pathname.startsWith('/shorts/')) {
        return u.pathname.split('/')[2] || null;
      }
      return u.searchParams.get('v');
    }
  } catch {
    return null;
  }
  return null;
}

function vimeoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('vimeo.com')) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    return parts[0] && /^\d+$/.test(parts[0]) ? parts[0] : null;
  } catch {
    return null;
  }
}

type Block =
  | { type: 'heading'; level: 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'youtube'; id: string; url: string }
  | { type: 'vimeo'; id: string; url: string }
  | { type: 'linkCard'; url: string };

function isBareUrlLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  // Don't treat markdown links as bare URL embeds
  if (trimmed.startsWith('[') && trimmed.includes('](')) return null;
  const match = trimmed.match(/^https?:\/\/[^\s<>"')\]]+$/i);
  if (!match) return null;
  return match[0].replace(/[.,;:!?)]+$/, '');
}

function parseBlocks(body: string): Block[] {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    const text = paragraph.join('\n').trim();
    paragraph = [];
    if (text) blocks.push({ type: 'paragraph', text });
  }

  for (const line of lines) {
    const bare = isBareUrlLine(line);
    if (bare) {
      flushParagraph();
      const yt = youtubeId(bare);
      const vm = vimeoId(bare);
      if (yt) blocks.push({ type: 'youtube', id: yt, url: bare });
      else if (vm) blocks.push({ type: 'vimeo', id: vm, url: bare });
      else blocks.push({ type: 'linkCard', url: bare });
      continue;
    }

    const h2 = line.match(/^##\s+(.+)$/);
    if (h2?.[1]) {
      flushParagraph();
      blocks.push({ type: 'heading', level: 2, text: h2[1] });
      continue;
    }
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3?.[1]) {
      flushParagraph();
      blocks.push({ type: 'heading', level: 3, text: h3[1] });
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  return blocks;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  const re = new RegExp(INLINE_RE);
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = re.exec(text)) != null) {
    if (match.index > last) {
      nodes.push(...renderPlainWithUrls(text.slice(last, match.index), `${keyPrefix}-t${i++}`));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={`${keyPrefix}-b${i++}`}>{token.slice(2, -2)}</strong>,
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(<em key={`${keyPrefix}-i${i++}`}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code key={`${keyPrefix}-c${i++}`} className="rounded bg-surface-muted px-1 text-sm">
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
      if (linkMatch) {
        nodes.push(
          <a
            key={`${keyPrefix}-a${i++}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            {linkMatch[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    }
    last = match.index + token.length;
  }
  if (last < text.length) {
    nodes.push(...renderPlainWithUrls(text.slice(last), `${keyPrefix}-t${i++}`));
  }
  return nodes.length ? nodes : [text];
}

/** Escape HTML risk by never using dangerouslySetInnerHTML — only React text + safe <a>. */
function renderPlainWithUrls(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  const re = new RegExp(URL_RE);
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = re.exec(text)) != null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const raw = match[0];
    const url = raw.replace(/[.,;:!?)]+$/, '');
    const trailing = raw.slice(url.length);
    nodes.push(
      <a
        key={`${keyPrefix}-u${i++}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2"
      >
        {url}
      </a>,
    );
    if (trailing) nodes.push(trailing);
    last = match.index + raw.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length ? nodes : [text];
}

function LinkCard({ url }: { url: string }) {
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    /* keep raw */
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-border bg-surface p-4 no-underline transition hover:border-foreground/30"
    >
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{host}</p>
      <p className="mt-1 break-all text-sm text-foreground">{url}</p>
    </a>
  );
}

export function JournalArticleBody({
  body,
  gallery,
  dir,
}: {
  body: string;
  gallery?: JournalArticleImageDto[];
  dir?: 'ltr' | 'rtl';
}) {
  const blocks = parseBlocks(body);

  return (
    <div className="space-y-6" dir={dir}>
      {gallery && gallery.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {gallery.map((img) => {
            const src = mediaUrl(img.url) ?? img.url;
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={img.id}
                src={src}
                alt={img.alt ?? ''}
                className="aspect-[4/5] w-full rounded-md object-cover"
              />
            );
          })}
        </div>
      )}

      <div className="prose prose-neutral max-w-none space-y-4 text-foreground">
        {blocks.map((block, i) => {
          if (block.type === 'heading') {
            const className =
              block.level === 2
                ? 'font-display text-2xl text-foreground'
                : 'font-display text-xl text-foreground';
            const Tag = block.level === 2 ? 'h2' : 'h3';
            return (
              <Tag key={i} className={className}>
                {renderInline(block.text, `h${i}`)}
              </Tag>
            );
          }
          if (block.type === 'paragraph') {
            return (
              <p key={i} className="whitespace-pre-wrap leading-relaxed">
                {renderInline(block.text, `p${i}`)}
              </p>
            );
          }
          if (block.type === 'youtube') {
            return (
              <div key={i} className="aspect-video overflow-hidden rounded-lg bg-surface-muted">
                <iframe
                  title="YouTube video"
                  src={`https://www.youtube.com/embed/${block.id}`}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            );
          }
          if (block.type === 'vimeo') {
            return (
              <div key={i} className="aspect-video overflow-hidden rounded-lg bg-surface-muted">
                <iframe
                  title="Vimeo video"
                  src={`https://player.vimeo.com/video/${block.id}`}
                  className="h-full w-full"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              </div>
            );
          }
          return <LinkCard key={i} url={block.url} />;
        })}
      </div>
    </div>
  );
}
