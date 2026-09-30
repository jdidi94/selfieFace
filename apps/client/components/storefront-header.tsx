'use client';

import { BrandLogo } from '@/components/brand-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { LocaleLink } from '@/components/locale-link';
import { useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-context';
import { useCurrency } from '@/lib/currency-context';
import { useLocale } from '@/lib/locale-context';
import { withMarketLocale } from '@/lib/market-path';
import { getMessages } from '@/lib/messages';
import { useStorefrontPanels } from '@/lib/storefront-panels';
import { authPathWithReturn } from '@/lib/auth-return';
import { MARKET_BY_CURRENCY } from '@lumea/types';
import { Button } from '@lumea/ui';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Menu, ShoppingBag, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export function StorefrontHeader() {
  const { user, loading } = useAuth();
  const { cart } = useCart();
  const { locale, dir } = useLocale();
  const { currency } = useCurrency();
  const market = MARKET_BY_CURRENCY[currency];
  const { openBag, openFavorites } = useStorefrontPanels();
  const t = getMessages(locale);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const count = cart?.itemCount ?? 0;
  const [open, setOpen] = useState(false);
  const currentSearch = searchParams.toString();
  const currentPath = `${pathname}${currentSearch ? `?${currentSearch}` : ''}`;
  const signInHref = authPathWithReturn('/account/login', currentPath);

  const navLinks = [
    { href: '/shop', label: t.shop },
    { href: '/search', label: t.search },
    { href: '/journal', label: t.journal },
    { href: '/help', label: t.footerHelp },
    { href: '/contact', label: t.footerContact },
    { href: '/about', label: t.about },
  ];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [locale]);

  return (
    <motion.header
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-sm"
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 md:hidden"
          aria-label={open ? t.closeMenu : t.openMenu}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>

        <LocaleLink
          href="/"
          className="shrink-0"
          onClick={() => setOpen(false)}
          aria-label="Selfieface"
        >
          <BrandLogo variant="header" priority />
        </LocaleLink>

        <nav className="ms-6 hidden items-center gap-8 md:flex" aria-label={t.menu}>
          {navLinks.map((link) => (
            <LocaleLink
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </LocaleLink>
          ))}
        </nav>

        <div className="ms-auto flex min-w-0 items-center gap-0.5 sm:gap-1">
          <div className="hidden items-center gap-1 lg:flex">
            <LanguageSwitcher />
          </div>
          <ThemeToggle />
          {!loading && (
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
              <LocaleLink href={user ? '/account' : signInHref}>
                {user ? t.account : t.signIn}
              </LocaleLink>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label={t.wishlist}
            onClick={() => {
              if (!user) {
                router.push(withMarketLocale(market, locale, authPathWithReturn('/account/login', currentPath)));
                return;
              }
              openFavorites();
            }}
          >
            <Heart className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t.bag}
            className="relative"
            onClick={() => openBag()}
          >
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
                {count}
              </span>
            )}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              aria-label={t.closeMenu}
              className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[2px] md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={t.menu}
              className="absolute inset-x-0 top-16 z-50 border-b border-border bg-background md:hidden"
              style={{ [dir === 'rtl' ? 'right' : 'left']: 0 }}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 sm:px-6">
                {navLinks.map((link) => (
                  <LocaleLink
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="rounded-sm px-3 py-3 text-base text-foreground transition-colors hover:bg-surface-muted"
                  >
                    {link.label}
                  </LocaleLink>
                ))}
                {!loading && (
                  <LocaleLink
                    href={user ? '/account' : signInHref}
                    onClick={() => setOpen(false)}
                    className="rounded-sm px-3 py-3 text-base text-foreground transition-colors hover:bg-surface-muted sm:hidden"
                  >
                    {user ? t.account : t.signIn}
                  </LocaleLink>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border px-3 pt-4 lg:hidden">
                  <LanguageSwitcher />
                </div>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
