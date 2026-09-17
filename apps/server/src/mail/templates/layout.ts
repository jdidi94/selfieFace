const BRAND = {
  name: 'Selfieface',
  bg: '#f7f4ef',
  ink: '#171512',
  muted: '#6f6a61',
  accent: '#381f43',
  surface: '#fcfaf7',
  border: '#d8cfc5',
};

function storefrontOrigin(): string {
  const raw =
    process.env.STOREFRONT_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.CLIENT_URL?.trim() ||
    'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

export function brandEmailLogoUrl(): string {
  return `${storefrontOrigin()}/brand/email-logo.png`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function wrapHtml(opts: {
  title: string;
  preheader?: string;
  bodyHtml: string;
}): string {
  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(opts.preheader)}</div>`
    : '';
  const logoUrl = brandEmailLogoUrl();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};color:${BRAND.ink};font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:${BRAND.surface};border:1px solid ${BRAND.border};">
          <tr>
            <td style="padding:28px 28px 12px;border-bottom:1px solid ${BRAND.border};">
              <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(BRAND.name)}" width="160" height="137" style="display:block;width:160px;height:auto;border:0;" />
            </td>
          </tr>
          <tr>
            <td style="padding:28px;font-size:15px;line-height:1.55;color:${BRAND.ink};">
              ${opts.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 28px;font-size:12px;line-height:1.5;color:${BRAND.muted};border-top:1px solid ${BRAND.border};">
              You’re receiving this email from ${BRAND.name}. Questions? Reply to this message or visit our storefront.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function ctaButton(href: string, label: string): string {
  return `<p style="margin:24px 0 8px;">
  <a href="${escapeHtml(href)}" style="display:inline-block;background:${BRAND.accent};color:${BRAND.bg};text-decoration:none;padding:12px 20px;font-size:14px;letter-spacing:0.02em;">${escapeHtml(label)}</a>
</p>`;
}
