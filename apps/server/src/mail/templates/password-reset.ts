import { ctaButton, escapeHtml, wrapHtml } from './layout';

export function passwordResetEmail(opts: {
  resetUrl: string;
  firstName?: string | null;
}): { subject: string; html: string; text: string } {
  const greeting = opts.firstName?.trim()
    ? `Hi ${opts.firstName.trim()},`
    : 'Hi,';
  const subject = 'Reset your Selfieface password';
  const html = wrapHtml({
    title: subject,
    preheader: 'Use this link within one hour to choose a new password.',
    bodyHtml: `
      <p style="margin:0 0 12px;">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 12px;">We received a request to reset your Selfieface account password. This link expires in one hour.</p>
      ${ctaButton(opts.resetUrl, 'Reset password')}
      <p style="margin:16px 0 0;font-size:13px;color:#6f6a61;">If you didn’t ask for this, you can ignore this email.</p>
    `,
  });
  const text = `${greeting}

We received a request to reset your Selfieface account password. This link expires in one hour:

${opts.resetUrl}

If you didn’t ask for this, you can ignore this email.`;
  return { subject, html, text };
}
