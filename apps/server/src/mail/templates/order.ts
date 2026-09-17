import { formatMoney } from '@lumea/utils';
import type { OrderMailContext } from '../mail.types';
import { ctaButton, escapeHtml, wrapHtml } from './layout';

function itemsHtml(ctx: OrderMailContext): string {
  const rows = ctx.items
    .map(
      (item) =>
        `<tr>
          <td style="padding:6px 0;border-bottom:1px solid #ded8cf;">${escapeHtml(item.name)} × ${item.quantity}</td>
          <td style="padding:6px 0;border-bottom:1px solid #ded8cf;text-align:right;">${escapeHtml(formatMoney(item.lineTotal, ctx.currency))}</td>
        </tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">${rows}</table>`;
}

function itemsText(ctx: OrderMailContext): string {
  return ctx.items
    .map(
      (item) =>
        `- ${item.name} × ${item.quantity}: ${formatMoney(item.lineTotal, ctx.currency)}`,
    )
    .join('\n');
}

export function orderConfirmationEmail(ctx: OrderMailContext): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Order ${ctx.orderNumber} confirmed`;
  const orderLink = ctx.orderUrl ?? ctx.storefrontUrl;
  const html = wrapHtml({
    title: subject,
    preheader: `Thanks for your order — total ${formatMoney(ctx.total, ctx.currency)}.`,
    bodyHtml: `
      <p style="margin:0 0 12px;">Hi ${escapeHtml(ctx.customerName)},</p>
      <p style="margin:0 0 12px;">Thank you for shopping with Selfieface. We’ve received order <strong>${escapeHtml(ctx.orderNumber)}</strong>.</p>
      ${itemsHtml(ctx)}
      <p style="margin:0 0 12px;"><strong>Total:</strong> ${escapeHtml(formatMoney(ctx.total, ctx.currency))}</p>
      ${ctaButton(orderLink, 'View order')}
    `,
  });
  const text = `Hi ${ctx.customerName},

Thank you for shopping with Selfieface. We’ve received order ${ctx.orderNumber}.

${itemsText(ctx)}

Total: ${formatMoney(ctx.total, ctx.currency)}

${orderLink}`;
  return { subject, html, text };
}

export function orderShippedEmail(ctx: OrderMailContext): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Order ${ctx.orderNumber} is on its way`;
  const tracking = ctx.trackingNote?.trim();
  const orderLink = ctx.orderUrl ?? ctx.storefrontUrl;
  const html = wrapHtml({
    title: subject,
    preheader: tracking || 'Your Selfieface order has shipped.',
    bodyHtml: `
      <p style="margin:0 0 12px;">Hi ${escapeHtml(ctx.customerName)},</p>
      <p style="margin:0 0 12px;">Order <strong>${escapeHtml(ctx.orderNumber)}</strong> has shipped.</p>
      ${tracking ? `<p style="margin:0 0 12px;"><strong>Tracking / note:</strong> ${escapeHtml(tracking)}</p>` : ''}
      ${ctaButton(orderLink, 'Track order')}
    `,
  });
  const text = `Hi ${ctx.customerName},

Order ${ctx.orderNumber} has shipped.
${tracking ? `\nTracking / note: ${tracking}\n` : ''}
${orderLink}`;
  return { subject, html, text };
}

export function orderDeliveredEmail(ctx: OrderMailContext): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Order ${ctx.orderNumber} delivered`;
  const orderLink = ctx.orderUrl ?? ctx.storefrontUrl;
  const html = wrapHtml({
    title: subject,
    preheader: 'Your Selfieface order was marked delivered.',
    bodyHtml: `
      <p style="margin:0 0 12px;">Hi ${escapeHtml(ctx.customerName)},</p>
      <p style="margin:0 0 12px;">Order <strong>${escapeHtml(ctx.orderNumber)}</strong> has been marked as delivered. We hope you love what’s inside.</p>
      ${ctaButton(orderLink, 'View order')}
    `,
  });
  const text = `Hi ${ctx.customerName},

Order ${ctx.orderNumber} has been marked as delivered. We hope you love what’s inside.

${orderLink}`;
  return { subject, html, text };
}

export function orderCancelledEmail(ctx: OrderMailContext): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Order ${ctx.orderNumber} cancelled`;
  const orderLink = ctx.orderUrl ?? ctx.storefrontUrl;
  const html = wrapHtml({
    title: subject,
    preheader: 'Your Selfieface order was cancelled.',
    bodyHtml: `
      <p style="margin:0 0 12px;">Hi ${escapeHtml(ctx.customerName)},</p>
      <p style="margin:0 0 12px;">Order <strong>${escapeHtml(ctx.orderNumber)}</strong> has been cancelled.${ctx.trackingNote ? ` ${escapeHtml(ctx.trackingNote)}` : ''}</p>
      <p style="margin:0 0 12px;">If you have questions, reply to this email or contact support.</p>
      ${ctaButton(orderLink, 'View order')}
    `,
  });
  const text = `Hi ${ctx.customerName},

Order ${ctx.orderNumber} has been cancelled.${ctx.trackingNote ? ` ${ctx.trackingNote}` : ''}

If you have questions, reply to this email or contact support.

${orderLink}`;
  return { subject, html, text };
}

export function adminOrderNotifyEmail(ctx: OrderMailContext): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `[Selfieface] New order ${ctx.orderNumber}`;
  const html = wrapHtml({
    title: subject,
    preheader: `${formatMoney(ctx.total, ctx.currency)} — ${ctx.customerName}`,
    bodyHtml: `
      <p style="margin:0 0 12px;">New order <strong>${escapeHtml(ctx.orderNumber)}</strong> from ${escapeHtml(ctx.customerName)} (${escapeHtml(ctx.email)}).</p>
      ${itemsHtml(ctx)}
      <p style="margin:0 0 12px;"><strong>Total:</strong> ${escapeHtml(formatMoney(ctx.total, ctx.currency))} · <strong>Status:</strong> ${escapeHtml(ctx.status)}</p>
    `,
  });
  const text = `New order ${ctx.orderNumber} from ${ctx.customerName} (${ctx.email}).

${itemsText(ctx)}

Total: ${formatMoney(ctx.total, ctx.currency)}
Status: ${ctx.status}`;
  return { subject, html, text };
}
