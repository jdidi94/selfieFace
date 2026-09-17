import { escapeHtml, wrapHtml } from './layout';

export function marketingEmail(opts: {
  subject: string;
  previewText?: string;
  bodyHtml: string;
  bodyText: string;
  unsubscribeUrl?: string;
}): { subject: string; html: string; text: string } {
  const unsub = opts.unsubscribeUrl
    ? `<p style="margin:24px 0 0;font-size:12px;color:#6f6a61;">
  <a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:#6f6a61;">Unsubscribe</a>
</p>`
    : '';
  const html = wrapHtml({
    title: opts.subject,
    preheader: opts.previewText,
    bodyHtml: `${opts.bodyHtml}${unsub}`,
  });
  const text = opts.unsubscribeUrl
    ? `${opts.bodyText}\n\nUnsubscribe: ${opts.unsubscribeUrl}`
    : opts.bodyText;
  return {
    subject: opts.subject,
    html,
    text,
  };
}
