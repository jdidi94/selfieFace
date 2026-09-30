import { StorefrontDrawers } from '@/components/storefront-drawers';
import { StorefrontFooter } from '@/components/storefront-footer';
import { StorefrontHeader } from '@/components/storefront-header';
import { ActiveCouponsBar } from '@/components/active-coupons-bar';
import { CookieConsentBanner } from '@/components/cookie-consent-banner';
import { MarketUnavailable } from '@/components/market-unavailable';
import { OrganizationWebsiteJsonLd } from '@/components/organization-website-json-ld';
import { PageTransition } from '@/components/page-transition';
import { PwaRegister } from '@/components/pwa-register';
import { AuthProvider } from '@/lib/auth-context';
import { BehaviorCollector } from '@/lib/behavior';
import { CartProvider } from '@/lib/cart-context';
import { CurrencyProvider } from '@/lib/currency-context';
import { LocaleProvider } from '@/lib/locale-context';
import { StorefrontPanelsProvider } from '@/lib/storefront-panels';
import { ThemeProvider, THEME_INIT_SCRIPT, type Theme } from '@/lib/theme-context';
import { fetchApi } from '@/lib/api';
import { absoluteUrl, siteUrl } from '@/lib/seo';
import { getStorefrontWindow } from '@/lib/storefront-window';
import type { MarketDto, StoreContactDto } from '@lumea/types';
import { Toaster } from '@lumea/ui';
import { isRtlLocale } from '@lumea/utils';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Cormorant_Garamond, DM_Sans } from 'next/font/google';
import '../styles/globals.css';

const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-display',
});

const sans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
});

function parseTheme(value?: string): Theme {
  return value === 'dark' ? 'dark' : 'light';
}

export async function generateMetadata(): Promise<Metadata> {
  const { currency } = await getStorefrontWindow();
  let marketEnabled = true;
  try {
    const market = await fetchApi<MarketDto>(
      `/store/market?currency=${encodeURIComponent(currency)}`,
    );
    marketEnabled = market.enabled;
  } catch {
    // API may be unavailable during local setup
  }

  const ogImage = absoluteUrl('/brand/open-graph.png');

  return {
    metadataBase: new URL(siteUrl()),
    title: {
      default: 'Selfieface',
      template: '%s · Selfieface',
    },
    description: 'A modern editorial beauty boutique',
    icons: {
      icon: [{ url: '/brand/favicon.png', type: 'image/png' }],
      apple: [{ url: '/brand/apple-touch.png', sizes: '180x180', type: 'image/png' }],
    },
    manifest: '/brand/site.webmanifest',
    openGraph: {
      siteName: 'Selfieface',
      type: 'website',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: 'Selfieface',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      images: [ogImage],
    },
    ...(marketEnabled
      ? {}
      : {
          robots: {
            index: false,
            follow: false,
          },
        }),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const { locale, currency, market } = await getStorefrontWindow();
  const theme = parseTheme(
    cookieStore.get('selfieface_theme')?.value ?? cookieStore.get('lumea_theme')?.value,
  );
  const dir = isRtlLocale(locale) ? 'rtl' : 'ltr';

  let marketEnabled = true;
  try {
    const market = await fetchApi<MarketDto>(
      `/store/market?currency=${encodeURIComponent(currency)}`,
    );
    marketEnabled = market.enabled;
  } catch {
    // API may be unavailable during local setup — allow browsing
  }

  let storeContact: StoreContactDto = {};
  if (marketEnabled) {
    try {
      storeContact = await fetchApi<StoreContactDto>(
        `/store/contact?currency=${encodeURIComponent(currency)}`,
      );
    } catch {
      // API may be unavailable during local setup
    }
  }

  return (
    <html
      lang={locale}
      dir={dir}
      className={theme === 'dark' ? 'dark' : undefined}
      style={{ colorScheme: theme }}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {marketEnabled ? (
          <OrganizationWebsiteJsonLd locale={locale} market={market} />
        ) : null}
      </head>
      <body
        className={`${display.variable} ${sans.variable} min-h-screen antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider initialTheme={theme}>
          <AuthProvider>
            <LocaleProvider initialLocale={locale}>
              <CurrencyProvider initialCurrency={currency}>
                {marketEnabled ? (
                  <CartProvider>
                    <StorefrontPanelsProvider>
                      <BehaviorCollector locale={locale} />
                      <StorefrontHeader />
                      <ActiveCouponsBar />
                      <PageTransition>{children}</PageTransition>
                      <StorefrontFooter contact={storeContact} />
                      <StorefrontDrawers />
                      <CookieConsentBanner />
                      <PwaRegister />
                      <Toaster />
                    </StorefrontPanelsProvider>
                  </CartProvider>
                ) : (
                  <MarketUnavailable locale={locale} />
                )}
              </CurrencyProvider>
            </LocaleProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
