import { ctaButton, escapeHtml, wrapHtml } from './layout';

export function accountBlockedEmail(opts: {
  firstName?: string | null;
  storefrontUrl: string;
  supportEmail?: string | null;
}): { subject: string; html: string; text: string } {
  const greeting = opts.firstName?.trim()
    ? `Hi ${opts.firstName.trim()},`
    : 'Hi,';
  const subject = 'Your Selfieface account has been blocked';
  const supportLine = opts.supportEmail?.trim()
    ? `If you believe this is a mistake, contact us at ${opts.supportEmail.trim()}.`
    : 'If you believe this is a mistake, reply to this email or contact support.';
  const html = wrapHtml({
    title: subject,
    preheader: 'Your account access has been restricted.',
    bodyHtml: `
      <p style="margin:0 0 12px;">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 12px;">Your Selfieface account has been blocked and you can no longer sign in. Existing sessions will stop working shortly.</p>
      <p style="margin:0 0 12px;">${escapeHtml(supportLine)}</p>
      ${ctaButton(opts.storefrontUrl, 'Visit Selfieface')}
    `,
  });
  const text = `${greeting}

Your Selfieface account has been blocked and you can no longer sign in. Existing sessions will stop working shortly.

${supportLine}

${opts.storefrontUrl}`;
  return { subject, html, text };
}

export function accountUnblockedEmail(opts: {
  firstName?: string | null;
  storefrontUrl: string;
}): { subject: string; html: string; text: string } {
  const greeting = opts.firstName?.trim()
    ? `Hi ${opts.firstName.trim()},`
    : 'Hi,';
  const subject = 'Your Selfieface account has been restored';
  const signInUrl = `${opts.storefrontUrl.replace(/\/$/, '')}/account/login`;
  const html = wrapHtml({
    title: subject,
    preheader: 'You can sign in to Selfieface again.',
    bodyHtml: `
      <p style="margin:0 0 12px;">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 12px;">Good news — your Selfieface account access has been restored. You can sign in again anytime.</p>
      ${ctaButton(signInUrl, 'Sign in')}
    `,
  });
  const text = `${greeting}

Good news — your Selfieface account access has been restored. You can sign in again anytime.

${signInUrl}`;
  return { subject, html, text };
}
