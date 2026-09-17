'use client';

import { BrandLogo } from '@/components/brand-logo';
import { LocaleLink } from '@/components/locale-link';
import { NewsletterSignupForm } from '@/components/newsletter-signup-form';
import { StorefrontFooterContact } from '@/components/storefront-footer-contact';
import { useAuth } from '@/lib/auth-context';
import { useCurrency } from '@/lib/currency-context';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import type { StoreContactDto } from '@lumea/types';

export function StorefrontFooter({ contact }: { contact?: StoreContactDto }) {
  const { user } = useAuth();
  const { locale } = useLocale();
  const { currency } = useCurrency();
  const t = getMessages(locale);

  const shopLinks = [
    { href: '/shop', label: t.footerSkincare },
    { href: '/shop', label: t.footerBodyCare },
    { href: '/shop', label: t.footerMakeup },
    { href: '/shop', label: t.footerWellness },
  ];

  return (
    <footer className="border-t border-border bg-surface-muted/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-4">
        <div>
          <LocaleLink href="/" aria-label="Selfieface" className="inline-block">
            <BrandLogo variant="header" />
          </LocaleLink>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">{t.footerTagline}</p>
          <p className="mt-4 text-xs text-muted-foreground">{t.pricesInCurrency(currency)}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t.footerShop}
          </p>
          <ul className="mt-4 space-y-2">
            {shopLinks.map((link) => (
              <li key={link.label}>
                <LocaleLink
                  href={link.href}
                  className="text-sm text-foreground/80 hover:text-foreground"
                >
                  {link.label}
                </LocaleLink>
              </li>
            ))}
          </ul>
        </div>
        {contact ? <StorefrontFooterContact contact={contact} /> : null}
        <div className="space-y-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t.newsletterTitle}
            </p>
            <div className="mt-4">
              <NewsletterSignupForm />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t.footerLegal}
            </p>
            <ul className="mt-4 space-y-2 text-sm text-foreground/80">
              {!user ? (
                <li>
                  <LocaleLink href="/orders/track">{t.footerTrackOrder}</LocaleLink>
                </li>
              ) : null}
              <li>
                <LocaleLink href="#">{t.footerPrivacy}</LocaleLink>
              </li>
              <li>
                <LocaleLink href="#">{t.footerTerms}</LocaleLink>
              </li>
              <li>
                <LocaleLink href="#">{t.footerReturns}</LocaleLink>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Selfieface. {t.footerRights}
      </div>
    </footer>
  );
}
