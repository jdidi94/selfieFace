import { formatMoney } from '@lumea/utils';
import type { OrderMailContext } from '../mail.types';
import { ctaButton, escapeHtml, wrapHtml } from './layout';

type MailLocale = 'en' | 'fr' | 'ar';

function resolveLocale(locale?: string): MailLocale {
  if (locale === 'fr' || locale === 'ar') return locale;
  return 'en';
}

const copy = {
  en: {
    confirmedSubject: (n: string) => `Order ${n} confirmed`,
    confirmedPreheader: (total: string) => `Thanks for your order — total ${total}.`,
    hi: (name: string) => `Hi ${name},`,
    confirmedBody: (n: string) =>
      `Thank you for shopping with Selfieface. We’ve received order ${n}.`,
    total: 'Total',
    trackHint: (n: string) =>
      `Your order number is ${n}. Open your tracking link below anytime — no account needed.`,
    viewOrder: 'View order',
    trackOrder: 'Open tracking link',
    shippedSubject: (n: string) => `Order ${n} is on its way`,
    shippedPreheader: 'Your Selfieface order has shipped.',
    shippedBody: (n: string) => `Order ${n} has shipped.`,
    trackingNote: 'Tracking / note',
    deliveredSubject: (n: string) => `Order ${n} delivered`,
    deliveredPreheader: 'Your Selfieface order was marked delivered.',
    deliveredBody: (n: string) =>
      `Order ${n} has been marked as delivered. We hope you love what’s inside.`,
    cancelledSubject: (n: string) => `Order ${n} cancelled`,
    cancelledPreheader: 'Your Selfieface order was cancelled.',
    cancelledBody: (n: string) => `Order ${n} has been cancelled.`,
    cancelledSupport: 'If you have questions, reply to this email or contact support.',
  },
  fr: {
    confirmedSubject: (n: string) => `Commande ${n} confirmée`,
    confirmedPreheader: (total: string) => `Merci pour votre commande — total ${total}.`,
    hi: (name: string) => `Bonjour ${name},`,
    confirmedBody: (n: string) =>
      `Merci d’avoir choisi Selfieface. Nous avons bien reçu la commande ${n}.`,
    total: 'Total',
    trackHint: (n: string) =>
      `Votre numéro de commande est ${n}. Ouvrez votre lien de suivi ci-dessous à tout moment — sans compte.`,
    viewOrder: 'Voir la commande',
    trackOrder: 'Ouvrir le lien de suivi',
    shippedSubject: (n: string) => `Commande ${n} en route`,
    shippedPreheader: 'Votre commande Selfieface a été expédiée.',
    shippedBody: (n: string) => `La commande ${n} a été expédiée.`,
    trackingNote: 'Suivi / note',
    deliveredSubject: (n: string) => `Commande ${n} livrée`,
    deliveredPreheader: 'Votre commande Selfieface a été marquée comme livrée.',
    deliveredBody: (n: string) =>
      `La commande ${n} a été marquée comme livrée. Nous espérons que vous aimerez ce qu’il y a à l’intérieur.`,
    cancelledSubject: (n: string) => `Commande ${n} annulée`,
    cancelledPreheader: 'Votre commande Selfieface a été annulée.',
    cancelledBody: (n: string) => `La commande ${n} a été annulée.`,
    cancelledSupport:
      'Pour toute question, répondez à cet e-mail ou contactez le support.',
  },
  ar: {
    confirmedSubject: (n: string) => `تأكيد الطلب ${n}`,
    confirmedPreheader: (total: string) => `شكراً لطلبك — الإجمالي ${total}.`,
    hi: (name: string) => `مرحباً ${name}،`,
    confirmedBody: (n: string) =>
      `شكراً لتسوقك مع Selfieface. استلمنا الطلب ${n}.`,
    total: 'الإجمالي',
    trackHint: (n: string) =>
      `رقم طلبك هو ${n}. افتحي رابط التتبّع أدناه في أي وقت — دون حساب.`,
    viewOrder: 'عرض الطلب',
    trackOrder: 'فتح رابط التتبّع',
    shippedSubject: (n: string) => `الطلب ${n} في الطريق`,
    shippedPreheader: 'تم شحن طلبك من Selfieface.',
    shippedBody: (n: string) => `تم شحن الطلب ${n}.`,
    trackingNote: 'التتبّع / ملاحظة',
    deliveredSubject: (n: string) => `تم تسليم الطلب ${n}`,
    deliveredPreheader: 'تم وضع علامة تسليم على طلب Selfieface.',
    deliveredBody: (n: string) =>
      `تم وضع علامة تسليم على الطلب ${n}. نتمنى أن يعجبك ما بداخله.`,
    cancelledSubject: (n: string) => `إلغاء الطلب ${n}`,
    cancelledPreheader: 'تم إلغاء طلب Selfieface.',
    cancelledBody: (n: string) => `تم إلغاء الطلب ${n}.`,
    cancelledSupport: 'إن كان لديك أسئلة، ردي على هذا البريد أو تواصلي مع الدعم.',
  },
} as const;

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
  const t = copy[resolveLocale(ctx.locale)];
  const total = formatMoney(ctx.total, ctx.currency);
  const subject = t.confirmedSubject(ctx.orderNumber);
  const orderLink = ctx.orderUrl ?? ctx.storefrontUrl;
  const isTrackLink = !!ctx.orderUrl?.includes('/orders/track');
  const ctaLabel = isTrackLink ? t.trackOrder : t.viewOrder;
  const trackHintHtml = isTrackLink
    ? `<p style="margin:0 0 12px;">${escapeHtml(t.trackHint(ctx.orderNumber)).replace(
        escapeHtml(ctx.orderNumber),
        `<strong>${escapeHtml(ctx.orderNumber)}</strong>`,
      )}</p>`
    : '';
  const trackHintText = isTrackLink ? `\n${t.trackHint(ctx.orderNumber)}\n` : '';
  const html = wrapHtml({
    title: subject,
    preheader: t.confirmedPreheader(total),
    bodyHtml: `
      <p style="margin:0 0 12px;">${escapeHtml(t.hi(ctx.customerName))}</p>
      <p style="margin:0 0 12px;">${escapeHtml(t.confirmedBody(ctx.orderNumber)).replace(
        escapeHtml(ctx.orderNumber),
        `<strong>${escapeHtml(ctx.orderNumber)}</strong>`,
      )}</p>
      ${itemsHtml(ctx)}
      <p style="margin:0 0 12px;"><strong>${escapeHtml(t.total)}:</strong> ${escapeHtml(total)}</p>
      ${trackHintHtml}
      ${ctaButton(orderLink, ctaLabel)}
    `,
  });
  const text = `${t.hi(ctx.customerName)}

${t.confirmedBody(ctx.orderNumber)}

${itemsText(ctx)}

${t.total}: ${total}
${trackHintText}
${ctaLabel}: ${orderLink}`;
  return { subject, html, text };
}

export function orderShippedEmail(ctx: OrderMailContext): {
  subject: string;
  html: string;
  text: string;
} {
  const t = copy[resolveLocale(ctx.locale)];
  const subject = t.shippedSubject(ctx.orderNumber);
  const tracking = ctx.trackingNote?.trim();
  const orderLink = ctx.orderUrl ?? ctx.storefrontUrl;
  const html = wrapHtml({
    title: subject,
    preheader: tracking || t.shippedPreheader,
    bodyHtml: `
      <p style="margin:0 0 12px;">${escapeHtml(t.hi(ctx.customerName))}</p>
      <p style="margin:0 0 12px;">${escapeHtml(t.shippedBody(ctx.orderNumber)).replace(
        escapeHtml(ctx.orderNumber),
        `<strong>${escapeHtml(ctx.orderNumber)}</strong>`,
      )}</p>
      ${tracking ? `<p style="margin:0 0 12px;"><strong>${escapeHtml(t.trackingNote)}:</strong> ${escapeHtml(tracking)}</p>` : ''}
      ${ctaButton(orderLink, t.trackOrder)}
    `,
  });
  const text = `${t.hi(ctx.customerName)}

${t.shippedBody(ctx.orderNumber)}
${tracking ? `\n${t.trackingNote}: ${tracking}\n` : ''}
${orderLink}`;
  return { subject, html, text };
}

export function orderDeliveredEmail(ctx: OrderMailContext): {
  subject: string;
  html: string;
  text: string;
} {
  const t = copy[resolveLocale(ctx.locale)];
  const subject = t.deliveredSubject(ctx.orderNumber);
  const orderLink = ctx.orderUrl ?? ctx.storefrontUrl;
  const html = wrapHtml({
    title: subject,
    preheader: t.deliveredPreheader,
    bodyHtml: `
      <p style="margin:0 0 12px;">${escapeHtml(t.hi(ctx.customerName))}</p>
      <p style="margin:0 0 12px;">${escapeHtml(t.deliveredBody(ctx.orderNumber)).replace(
        escapeHtml(ctx.orderNumber),
        `<strong>${escapeHtml(ctx.orderNumber)}</strong>`,
      )}</p>
      ${ctaButton(orderLink, t.viewOrder)}
    `,
  });
  const text = `${t.hi(ctx.customerName)}

${t.deliveredBody(ctx.orderNumber)}

${orderLink}`;
  return { subject, html, text };
}

export function orderCancelledEmail(ctx: OrderMailContext): {
  subject: string;
  html: string;
  text: string;
} {
  const t = copy[resolveLocale(ctx.locale)];
  const subject = t.cancelledSubject(ctx.orderNumber);
  const orderLink = ctx.orderUrl ?? ctx.storefrontUrl;
  const note = ctx.trackingNote ? ` ${ctx.trackingNote}` : '';
  const html = wrapHtml({
    title: subject,
    preheader: t.cancelledPreheader,
    bodyHtml: `
      <p style="margin:0 0 12px;">${escapeHtml(t.hi(ctx.customerName))}</p>
      <p style="margin:0 0 12px;">${escapeHtml(t.cancelledBody(ctx.orderNumber) + note).replace(
        escapeHtml(ctx.orderNumber),
        `<strong>${escapeHtml(ctx.orderNumber)}</strong>`,
      )}</p>
      <p style="margin:0 0 12px;">${escapeHtml(t.cancelledSupport)}</p>
      ${ctaButton(orderLink, t.viewOrder)}
    `,
  });
  const text = `${t.hi(ctx.customerName)}

${t.cancelledBody(ctx.orderNumber)}${note}

${t.cancelledSupport}

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
