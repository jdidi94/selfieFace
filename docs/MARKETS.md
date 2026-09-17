# Market windows (AE / TN / OTHER)

Selfieface runs as **three commercial windows** in one codebase:

| Code | Region | Currency cookie (`lumea_currency`) |
| --- | --- | --- |
| `AE` | Emirates | `AED` |
| `TN` | Tunisia | `TND` |
| `OTHER` | Rest of world | `USD` |

There is **no copy/transfer** between windows. Admin works in one selected window at a time; the storefront resolves the window from the currency cookie.

## Storefront SEO URLs (market windows)

Crawlable shop URLs are **path-based** (not cookie-only):

| Market | Path segment | Currency cookie |
| --- | --- | --- |
| AE | `/ae/...` | `AED` |
| TN | `/tn/...` | `TND` |
| OTHER | `/other/...` | `USD` |

**Canonical pattern:** `/{market}/{locale}/…`  
Examples: `/ae/en/shop`, `/tn/ar/products/serum`, `/other/fr/journal`.

- Middleware **rewrites** to the existing App Router paths (`/shop`, `/products/[slug]`, …) and syncs `lumea_currency` + `lumea_locale` from the URL.
- Bare paths (`/shop`) or locale-only paths (`/en/shop`) **redirect** into `/{market}/{locale}/…` using the currency cookie, then geo (`CF-IPCountry` / Vercel geo), else **OTHER**.
- Legacy `?hl=ar` still redirects into the prefixed URL.

### Hreflang / canonicals

- Canonical and Open Graph URL are **per market + locale**.
- `alternates.languages` lists **same-market locales only** (catalogs differ across AE/TN/OTHER; do not cross-link product slugs between markets).
- Tags: `en-AE` / `ar-AE` / `fr-AE`, `en-TN` / …, and bare `en` / `ar` / `fr` for OTHER.
- `x-default` → **same-market English** (not a cross-market OTHER fallback), so a TN product never points `x-default` at a missing OTHER slug.

### Sitemap

`app/sitemap.ts` loads **enabled** markets from `GET /api/markets`, then emits static + product/category/journal URLs for each with `?currency=` matching that window. Disabled markets are omitted.

### Disabled market

When `GET /api/store/market?currency=…` returns `enabled: false`, the storefront shows “Service not available in your area” and root `generateMetadata` sets **`robots: noindex, nofollow`**. Those URLs are not in the sitemap.

### Internal links

`LocaleLink`, language switcher, product cards, and nav prefix the active market so users and crawlers stay in-window. Commerce APIs still key off `lumea_currency` (kept in sync by middleware).

---

## Migration notes

- Existing `StoreSettings` (`id=default`) → cloned into **AE**, **TN**, and **OTHER** (same starting config). Primary key is now the market code.
- **StoreSettings / ShippingMethod** later simplified to **single-currency fields per window** (`freeShippingEnabled`, `freeShippingThreshold`, `domesticShipping`, `internationalShipping`, method `price`) — backfilled from the market’s currency columns (`AED`→AE, `TND`→TN, else USD).
- Existing **products**, **promo banners**, and **coupons** → assigned to **`OTHER`**. AE and TN catalogs start empty until you create catalog there.
- Existing **shipping methods** → **cloned into all three markets** (same codes/prices) so AE/TN keep working checkout methods after an empty-catalog start. Admin Settings edits methods for the selected window only. Public quotes use the visitor market (`lumea_currency` → AE/TN/OTHER).
- Existing **promotions** → assigned to **`OTHER`**. Slug unique per market.
- Existing **merchandising rail** pins → `marketId` taken from the product’s market (OTHER for seeded catalog). Admin rail curation is per working market.
- Existing **orders** → `marketId` backfilled from currency (`AED`→AE, `TND`→TN, else OTHER). New checkouts set `marketId` from order currency. Admin order list + analytics/dashboard filter by `marketId` (admin switcher / `x-market`), preferring that over currency mapping.
- Existing **categories** and **brands** → **cloned into all three markets**; product FKs remapped so each product points at the category/brand clone for its own `marketId`. Slugs unique **per market**.
- Existing **warehouses** → assigned to **OTHER**, with empty clones for AE/TN (same codes). Stock rows stay on OTHER warehouses; allocation uses warehouses in the product’s market only. One default warehouse **per market**.
- Existing **search insights** → assigned to **`OTHER`**. Unique on `(marketId, query, locale)`. New SEARCH behavior events attribute to the visitor market via currency cookie (`AED`→AE, `TND`→TN, else OTHER).
- Existing **journal articles** (incl. gallery images + translations) → **cloned into all three markets** for editorial continuity across windows. **Product links** stay on **OTHER** only (AE/TN catalogs were empty at migration; clones are editorial-only until same-market products are linked). Slug unique **per market**.
- Product `slug`, coupon `code`, shipping method `code`, promotion `slug`, category `slug`, brand `slug`, warehouse `code`, and journal article `slug` are unique **per market**.

## Coupons (per market)

Admin → Marketing → Coupons (scoped by **Working market** / `x-market`):

- **Percent** vs **fixed** discount. Fixed amounts and minimum subtotals use a single field in the **market currency** (`amountOff` / `minSubtotal`). Percent is currency-agnostic.
- Optional **customer description** shown on the storefront active-offers bar (`GET /store/coupons`).
- One coupon per cart; **loyalty points can stack** with a coupon (no exclusivity).
- **Product scope**: entire cart (`ALL`), or **INCLUDE** / **EXCLUDE** by product tags, explicit product IDs, “new in last 30 days”, minimum USD price helper, and/or minimum approved review rating.
- Optional **max uses** (global), **max uses per customer**, **start/end** dates, and active flag.
- Codes are unique per market — create the same promotional code separately in AE / TN / OTHER if you want it in more than one window.

## How to test

### Admin market switcher

1. Open admin → sidebar **Working market** select (Emirates / Tunisia / Others).
2. Cookie `admin_market` is set; all `adminFetch` calls send `x-market`.
3. **Settings**, **Products**, **Categories**, **Brands**, **Warehouses**, **Inventory**, **Coupons**, **Promotions**, **Merchandising rails**, **Search insights**, **Journal**, and **Orders** are scoped to that window.
4. **Analytics** / **Dashboard** filter paid orders by `Order.marketId` for the working market.
5. **Catalog → Markets** toggles `enabled` per window.

### Shipping per market

1. Switch admin to Emirates → Settings → edit a shipping method price (single field in AED minor units).
2. Switch to Others → confirm that method’s price is unchanged (separate rows).
3. Storefront with `lumea_currency=AED` → checkout quote returns AE method IDs only.

### Disabled window on client

1. In admin Markets, disable e.g. **Emirates**.
2. On the storefront, set cookie `lumea_currency=AED` (or visit from AE geo detection).
3. Layout loads `GET /api/store/market?currency=AED`; when `enabled: false`, the shop shows **“Service not available in your area”** (en/ar/fr).

### Public APIs

- `GET /api/markets` — list windows (sitemap uses `enabled`)
- `GET /api/store/market?currency=USD|TND|AED` — `{ code, enabled, currency }`
- Catalog caches are namespaced: `catalog:AE:…`, `catalog:TN:…`, `catalog:OTHER:…`
- Categories / brands / journal public lists take `?currency=` (same cookie mapping as products).
- Storefront SEO paths: `/ae|tn|other/{en|ar|fr}/…` (see [Storefront SEO URLs](#storefront-seo-urls-market-windows)).

### Verify SEO windows

```bash
# Sitemap should list /ae/, /tn/, /other/ for enabled markets only
curl -sS "$SITE/sitemap.xml" | head -n 80

# Product canonical differs by market path
curl -sSI "$SITE/ae/en/products/<slug>" | tr -d '\r' | grep -i location
curl -sS "$SITE/ae/en/products/<slug>" | grep -o 'rel="canonical" href="[^"]*"'
curl -sS "$SITE/tn/en/products/<slug>" | grep -o 'rel="canonical" href="[^"]*"'
```

## Still global

- Inventory **transfers across markets** are rejected (warehouses and variants must share a market).
- **BehaviorEvent** raw rows remain unscoped (search *insights* aggregates are per market).
- **Media**, customers, reviews, wishlist, loyalty, mail/newsletter logs, and admin users stay shared.

## Follow-ups

- Optional copy/transfer tooling between markets (explicitly out of scope for now)
- Optional single-currency coupon amount fields (`amountOff` / `minSubtotal` per market)
