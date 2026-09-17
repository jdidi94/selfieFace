'use client';

import type { StoreContactDto } from '@lumea/types';
import Link from 'next/link';

function whatsappHref(value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('wa.me/')) {
    return trimmed.startsWith('wa.me/') ? `https://${trimmed}` : trimmed;
  }
  const digits = trimmed.replace(/[^\d+]/g, '');
  return `https://wa.me/${digits.replace(/^\+/, '')}`;
}

export function StorefrontFooterContact({ contact }: { contact: StoreContactDto }) {
  const whatsapp = contact.whatsapp;
  const phone = contact.phone;
  const facebook = contact.facebook;
  const instagram = contact.instagram;
  const email = contact.email;

  const items = [
    whatsapp ? { href: whatsappHref(whatsapp), label: 'WhatsApp' } : null,
    facebook ? { href: facebook, label: 'Facebook' } : null,
    instagram ? { href: instagram, label: 'Instagram' } : null,
    phone ? { href: `tel:${phone}`, label: phone } : null,
    email ? { href: `mailto:${email}`, label: email } : null,
  ].filter(Boolean) as { href: string; label: string }[];

  if (!items.length) return null;

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Contact</p>
      <ul className="mt-4 space-y-2 text-sm text-foreground/80">
        {items.map((item) => (
          <li key={`${item.label}-${item.href}`}>
            <Link href={item.href} className="hover:text-foreground" target="_blank" rel="noreferrer">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
