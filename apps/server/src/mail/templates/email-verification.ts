import { ctaButton, escapeHtml, wrapHtml } from './layout';

export function emailVerificationEmail(opts: {
  verifyUrl: string;
  firstName?: string | null;
}): { subject: string; html: string; text: string } {
  const greeting = opts.firstName?.trim()
    ? `Hi ${opts.firstName.trim()},`
    : 'Hi,';
  const subject = 'Verify your Selfieface email';
  const html = wrapHtml({
    title: subject,
    preheader: 'Confirm your email to finish setting up your account.',
    bodyHtml: `
      <p style="margin:0 0 12px;">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 12px;">Thanks for joining Selfieface. Please confirm your email address so we can reach you about orders and account updates. This link expires in 24 hours.</p>
      ${ctaButton(opts.verifyUrl, 'Verify email')}
      <p style="margin:16px 0 0;font-size:13px;color:#6f6a61;">If you didn’t create an account, you can ignore this email.</p>
    `,
  });
  const text = `${greeting}

Thanks for joining Selfieface. Please confirm your email address so we can reach you about orders and account updates. This link expires in 24 hours:

${opts.verifyUrl}

If you didn’t create an account, you can ignore this email.`;
  return { subject, html, text };
}
