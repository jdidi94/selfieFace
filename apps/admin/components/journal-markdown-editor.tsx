'use client';

import { Button, Textarea } from '@lumea/ui';
import { useRef } from 'react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  dir?: 'ltr' | 'rtl';
  rows?: number;
  id?: string;
};

function wrapSelection(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
  placeholder = 'text',
) {
  const selected = value.slice(start, end) || placeholder;
  const next = value.slice(0, start) + before + selected + after + value.slice(end);
  const cursorStart = start + before.length;
  const cursorEnd = cursorStart + selected.length;
  return { next, cursorStart, cursorEnd };
}

function prefixLines(value: string, start: number, end: number, prefix: string) {
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const lineEndIdx = value.indexOf('\n', end);
  const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
  const block = value.slice(lineStart, lineEnd);
  const nextBlock = block
    .split('\n')
    .map((line) => (line.startsWith(prefix) ? line : `${prefix}${line || 'Heading'}`))
    .join('\n');
  const next = value.slice(0, lineStart) + nextBlock + value.slice(lineEnd);
  return {
    next,
    cursorStart: lineStart,
    cursorEnd: lineStart + nextBlock.length,
  };
}

/**
 * Lightweight markdown body editor: toolbar for headings, bold, italic, links.
 * Stores plain markdown; storefront renders safely and still embeds bare media URLs.
 */
export function JournalMarkdownEditor({ value, onChange, dir, rows = 12, id }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function apply(
    mutate: (
      value: string,
      start: number,
      end: number,
    ) => { next: string; cursorStart: number; cursorEnd: number },
  ) {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const { next, cursorStart, cursorEnd } = mutate(value, start, end);
    onChange(next);
    requestAnimationFrame(() => {
      if (!ref.current) return;
      ref.current.focus();
      ref.current.setSelectionRange(cursorStart, cursorEnd);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => apply((v, s, e) => prefixLines(v, s, e, '## '))}
        >
          H2
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => apply((v, s, e) => prefixLines(v, s, e, '### '))}
        >
          H3
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => apply((v, s, e) => wrapSelection(v, s, e, '**', '**', 'bold'))}
        >
          Bold
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => apply((v, s, e) => wrapSelection(v, s, e, '*', '*', 'italic'))}
        >
          Italic
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            apply((v, s, e) => {
              const selected = v.slice(s, e) || 'link text';
              const next =
                v.slice(0, s) + `[${selected}](https://)` + v.slice(e);
              const urlStart = s + selected.length + 3;
              return { next, cursorStart: urlStart, cursorEnd: urlStart + 'https://'.length };
            })
          }
        >
          Link
        </Button>
      </div>
      <Textarea
        ref={ref}
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir={dir}
        className="font-mono text-sm"
      />
      <p className="text-xs text-muted-foreground">
        Markdown: <code>## heading</code>, <code>**bold**</code>, <code>*italic*</code>,{' '}
        <code>[label](url)</code>. Paste a YouTube or https URL on its own line to embed.
      </p>
    </div>
  );
}
