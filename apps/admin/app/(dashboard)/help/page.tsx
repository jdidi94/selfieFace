'use client';

import { BookOpen } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

type Section = {
  id: string;
  title: string;
  body: ReactNode;
};

const sections: Section[] = [
  {
    id: 'overview',
    title: 'How the storefront is driven',
    body: (
      <>
        <p>
          The customer site (port 3000) reads catalog, banners, promotions, rails, and settings from
          the API. Almost everything you edit here appears on the storefront after save (some pages
          cache for about a minute).
        </p>
        <ul className="mt-3 list-disc space-y-1 ps-5">
          <li>
            <strong>Home hero carousel</strong> — banners with placement <code>Home hero</code>
          </li>
          <li>
            <strong>Home secondary cards</strong> — placement <code>Home secondary</code>
          </li>
          <li>
            <strong>Product tags</strong> — Incoming flag, Campaigns (promotions), Top rated (from
            reviews), Out of stock
          </li>
          <li>
            <strong>Homepage rails</strong> — Top / New / Incoming curated under Merchandising
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'media',
    title: 'Media you can add',
    body: (
      <>
        <p>
          Images are stored as <strong>Media</strong> records. Upload via{' '}
          <code>POST /api/admin/media</code> (multipart field name <code>file</code>) using an admin
          JWT, or paste a known media id where forms ask for <code>imageMediaId</code> /
          cover media.
        </p>
        <div className="mt-4 overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-muted/60 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Rule</th>
                <th className="px-3 py-2 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="px-3 py-2">Max size</td>
                <td className="px-3 py-2">5 MB per file</td>
              </tr>
              <tr>
                <td className="px-3 py-2">Formats</td>
                <td className="px-3 py-2">JPEG, PNG, WebP, GIF (browser-safe images recommended)</td>
              </tr>
              <tr>
                <td className="px-3 py-2">Where used</td>
                <td className="px-3 py-2">
                  Product gallery, brand photo URL or media, banner image, journal cover
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2">Public URL</td>
                <td className="px-3 py-2">
                  <code>/api/media/&#123;id&#125;</code> — also works with full https Unsplash URLs
                  in seed data
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2">Hero / banner tips</td>
                <td className="px-3 py-2">
                  Prefer wide images (~1600×900). Product cards use a 4:5 crop — center the subject.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-muted-foreground">
          Banner forms currently take an <strong>image media id</strong> (cuid). Upload first, copy
          the returned <code>id</code>, paste into the banner field. Brands can use an{' '}
          <code>imageUrl</code> (https) on the brand record.
        </p>
      </>
    ),
  },
  {
    id: 'links',
    title: 'Links & hrefs',
    body: (
      <>
        <p>Use storefront-relative paths so locale/currency cookies still apply:</p>
        <ul className="mt-3 list-disc space-y-1 ps-5">
          <li>
            <code>/shop</code> — all products
          </li>
          <li>
            <code>/shop?category=body</code> — category slug
          </li>
          <li>
            <code>/shop?promotion=1</code> — products in active campaigns
          </li>
          <li>
            <code>/shop?incoming=1</code> — incoming products
          </li>
          <li>
            <code>/shop?recommended=1</code> — popularity / recommended
          </li>
          <li>
            <code>/shop?brand=lumea</code> — brand slug
          </li>
          <li>
            <code>/products/&#123;slug&#125;</code> — product detail
          </li>
          <li>
            <code>/journal</code> or <code>/journal/&#123;slug&#125;</code>
          </li>
          <li>
            <code>/wishlist</code>, <code>/cart</code>, <code>/checkout</code>
          </li>
        </ul>
        <p className="mt-3">
          External https links are allowed on banners if you need a campaign microsite. Prefer
          internal paths for catalog traffic.
        </p>
      </>
    ),
  },
  {
    id: 'banners',
    title: 'Banners (carousel & cards)',
    body: (
      <>
        <ul className="list-disc space-y-2 ps-5">
          <li>
            <strong>Home hero</strong> — all active heroes become the homepage <em>carousel</em>{' '}
            (sorted by sort order). Add several for auto-rotate.
          </li>
          <li>
            <strong>Home secondary</strong> — grid of promo cards below categories (images optional).
          </li>
          <li>
            Translate <strong>EN / AR / FR</strong> titles (and optional subtitle + CTA label).
          </li>
          <li>
            Optional schedule: <code>startsAt</code> / <code>endsAt</code>. Inactive or out-of-window
            banners are hidden on the storefront.
          </li>
        </ul>
        <p className="mt-3">
          Manage at{' '}
          <Link href="/content/banners" className="underline underline-offset-2">
            Marketing → Banners
          </Link>
          .
        </p>
      </>
    ),
  },
  {
    id: 'catalog',
    title: 'Catalog, tags & pricing',
    body: (
      <>
        <ul className="list-disc space-y-2 ps-5">
          <li>
            <strong>Prices</strong> — set per currency (USD / TND / AED) in minor units (cents /
            millimes). Compare-at creates a sale look on cards.
          </li>
          <li>
            <strong>Incoming</strong> — product flag + optional date; shows Incoming tag and home
            rail.
          </li>
          <li>
            <strong>Product form live card</strong> — while creating/editing a product, the right-hand
            preview shows the storefront card with gallery cover, brand, prices/sale, and tags
            (Incoming, Promotion, Top rated, Out of stock). Upload <em>many</em> gallery images
            (≤5&nbsp;MB each); reorder so the first is the cover.
          </li>
          <li>
            <strong>Campaigns</strong> — attach products under Marketing → Campaigns for Promotion
            tags and the promotions rail / shop filter.
          </li>
          <li>
            <strong>Coupons</strong> — checkout codes (percent or fixed per currency); not the same
            as campaign badges.
          </li>
          <li>
            <strong>Locales</strong> — product/category/brand translations power EN/AR/FR storefront
            copy.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'orders',
    title: 'Orders & payment',
    body: (
      <>
        <ul className="list-disc space-y-2 ps-5">
          <li>
            <strong>Guests</strong> — cash on delivery only (phone → address → confirm).
          </li>
          <li>
            <strong>Signed-in customers</strong> — choose COD or card when enabled in Store
            settings. USD/AED card → Stripe; TND → Konnect.
          </li>
          <li>
            Configure COD / card toggles and provider secrets under System → Payments (or Settings
            → Payments & secrets). Tax (basis points) is added to shipping-inclusive totals and
            charged with the payment.
          </li>
          <li>
            COD orders show payment <code>AUTHORIZED</code> until you mark cash collected /
            progress fulfillment in Orders.
          </li>
          <li>
            <strong>Cancel</strong> (PENDING/PROCESSING) — restocks reserved inventory, cancels open
            Stripe intents, and for captured card payments issues a Stripe refund (
            <code>REFUNDED</code>).
          </li>
          <li>
            <strong>Refund payment</strong> — for captured cards at any stage (including returns after
            ship/deliver). Restocks inventory; cancels the order only if still PENDING/PROCESSING.
          </li>
          <li>
            Customers can cancel pending unpaid / COD orders from Account → Orders. Paid card
            cancellations are admin-only.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'checklist',
    title: 'Quick publish checklist',
    body: (
      <ol className="list-decimal space-y-2 ps-5">
        <li>Upload media (≤5 MB) and note the media id</li>
        <li>Create/update product with images, prices, translations</li>
        <li>Optional: mark Incoming or add to a Campaign for tags</li>
        <li>Add Home hero / secondary banners with hrefs and media ids</li>
        <li>Pin homepage rails under Merchandising if you want manual order</li>
        <li>
          Open the storefront (
          <a
            href="http://localhost:3000"
            className="underline underline-offset-2"
            target="_blank"
            rel="noreferrer"
          >
            :3000
          </a>
          ) and hard-refresh
        </li>
      </ol>
    ),
  },
];

export default function AdminHelpPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <p className="flex items-center gap-2 text-xs tracking-[0.18em] text-muted-foreground uppercase">
          <BookOpen className="h-3.5 w-3.5" />
          Guide
        </p>
        <h1 className="font-display mt-1 text-4xl font-medium text-foreground">Admin handbook</h1>
        <p className="mt-2 text-muted-foreground">
          What you can upload, which links to use, and how banners, tags, and checkout show on the
          customer site.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2 text-sm">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-sm border border-border bg-surface px-3 py-1.5 text-muted-foreground transition-colors hover:border-accent hover:text-foreground"
          >
            {s.title}
          </a>
        ))}
      </nav>

      {sections.map((s) => (
        <section key={s.id} id={s.id} className="scroll-mt-8 space-y-3 border-t border-border pt-8">
          <h2 className="font-display text-2xl text-foreground">{s.title}</h2>
          <div className="text-sm leading-relaxed text-foreground/90">{s.body}</div>
        </section>
      ))}
    </div>
  );
}
