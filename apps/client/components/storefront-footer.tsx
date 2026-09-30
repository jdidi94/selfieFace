'use client';

import { BrandLogo } from '@/components/brand-logo';
import { LocaleLink } from '@/components/locale-link';
import { NewsletterSignupForm } from '@/components/newsletter-signup-form';
import { StorefrontFooterContact } from '@/components/storefront-footer-contact';
import { fetchApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { clearCookieConsent } from '@/lib/cookie-consent';
import { useCurrency } from '@/lib/currency-context';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import { authPathWithReturn } from '@/lib/auth-return';
import type { CatalogCategory, StoreContactDto } from '@lumea/types';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export function StorefrontFooter({ contact }: { contact?: StoreContactDto }) {
  const { user } = useAuth();
  const { locale } = useLocale();
  const { currency } = useCurrency();
  const t = getMessages(locale);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.toString();
  const currentPath = `${pathname}${currentSearch ? `?${currentSearch}` : ''}`;
  const [categories, setCategories] = useState<CatalogCategory[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetchApi<CatalogCategory[]>(
      `/categories?locale=${locale}&currency=${currency}`,
    )
      .then((cats) => {
        if (!cancelled) setCategories(cats.filter((category) => category.kind !== 'PROBLEM').slice(0, 4));
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, [locale, currency]);

  const shopLinks =
    categories.length > 0
      ? categories.map((c) => ({
          href: `/shop/category/${c.slug}`,
          label: c.name,
        }))
      : [{ href: '/shop', label: t.footerShop }];

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
              <li key={`${link.href}-${link.label}`}>
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
              <li>
                <LocaleLink href="/about">{t.about}</LocaleLink>
              </li>
              <li>
                <LocaleLink href="/help">{t.footerHelp}</LocaleLink>
              </li>
              <li>
                <LocaleLink href="/contact">{t.footerContact}</LocaleLink>
              </li>
              {!user ? (
                <li>
                  <LocaleLink href={authPathWithReturn('/account/login', currentPath)}>{t.signIn}</LocaleLink>
                </li>
              ) : (
                <li>
                  <LocaleLink href="/account/orders">{t.viewOrders}</LocaleLink>
                </li>
              )}
              <li>
                <LocaleLink href="/legal/privacy">{t.footerPrivacy}</LocaleLink>
              </li>
              <li>
                <LocaleLink href="/legal/terms">{t.footerTerms}</LocaleLink>
              </li>
              <li>
                <LocaleLink href="/legal/cookies">{t.footerCookies}</LocaleLink>
              </li>
              <li>
                <button
                  type="button"
                  className="text-sm text-foreground/80 hover:text-foreground"
                  onClick={() => clearCookieConsent()}
                >
                  {t.cookieConsentChange}
                </button>
              </li>
              <li>
                <LocaleLink href="/legal/shipping">{t.footerShipping}</LocaleLink>
              </li>
              <li>
                <LocaleLink href="/legal/returns">{t.footerReturns}</LocaleLink>
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
