import { ctaButton, escapeHtml, wrapHtml } from './layout';

export function newsletterWelcomeEmail(opts: {
  shopUrl: string;
  unsubscribeUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = 'Welcome to the Selfieface newsletter';
  const bodyHtml = `
    <p style="margin:0 0 16px;">Thanks for joining Selfieface.</p>
    <p style="margin:0 0 16px;">We’ll share calm product drops, rituals, and journal notes — never spam.</p>
    ${ctaButton(opts.shopUrl, 'Explore the shop')}
    <p style="margin:24px 0 0;font-size:12px;color:#6f6a61;">
      <a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:#6f6a61;">Unsubscribe</a>
    </p>
  `;
  const html = wrapHtml({
    title: subject,
    preheader: 'Calm beauty notes from Selfieface.',
    bodyHtml,
  });
  const text = [
    'Thanks for joining Selfieface.',
    'We’ll share calm product drops, rituals, and journal notes — never spam.',
    `Shop: ${opts.shopUrl}`,
    `Unsubscribe: ${opts.unsubscribeUrl}`,
  ].join('\n\n');
  return { subject, html, text };
}
