import { ctaButton, escapeHtml, wrapHtml } from './layout';

export function restockEmail(opts: {
  productName: string;
  productUrl: string;
  variantLabel?: string | null;
}): { subject: string; html: string; text: string } {
  const variant = opts.variantLabel?.trim();
  const subject = `${opts.productName} is back in stock`;
  const detail = variant
    ? `<strong>${escapeHtml(opts.productName)}</strong> (${escapeHtml(variant)})`
    : `<strong>${escapeHtml(opts.productName)}</strong>`;
  const html = wrapHtml({
    title: subject,
    preheader: 'The piece you asked about is available again.',
    bodyHtml: `
      <p style="margin:0 0 12px;">Good news — ${detail} is back in stock at Selfieface.</p>
      <p style="margin:0 0 12px;">Stock can move quickly. Grab it while it’s available.</p>
      ${ctaButton(opts.productUrl, 'View product')}
    `,
  });
  const text = `Good news — ${opts.productName}${variant ? ` (${variant})` : ''} is back in stock at Selfieface.

${opts.productUrl}

Stock can move quickly. Grab it while it’s available.`;
  return { subject, html, text };
}
