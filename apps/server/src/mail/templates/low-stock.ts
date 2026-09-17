import { ctaButton, escapeHtml, wrapHtml } from './layout';

export function adminLowStockEmail(opts: {
  productName: string;
  variantName: string;
  sku: string;
  stock: number;
  threshold: number;
  inventoryUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `[Selfieface] Low stock: ${opts.sku} (${opts.stock} left)`;
  const html = wrapHtml({
    title: subject,
    preheader: `${opts.productName} — ${opts.variantName} is at or below ${opts.threshold}.`,
    bodyHtml: `
      <p style="margin:0 0 12px;"><strong>${escapeHtml(opts.productName)}</strong> (${escapeHtml(opts.variantName)}) just crossed your low-stock threshold.</p>
      <p style="margin:0 0 12px;"><strong>SKU:</strong> ${escapeHtml(opts.sku)} · <strong>Stock:</strong> ${opts.stock} · <strong>Threshold:</strong> ${opts.threshold}</p>
      ${ctaButton(opts.inventoryUrl, 'Open inventory')}
    `,
  });
  const text = `Low stock alert

${opts.productName} (${opts.variantName})
SKU: ${opts.sku}
Stock: ${opts.stock}
Threshold: ${opts.threshold}

${opts.inventoryUrl}`;
  return { subject, html, text };
}
