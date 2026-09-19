# Local setup

## Prerequisites

- Node.js 22+
- pnpm 9 (`corepack enable` or `npm i -g pnpm`)
- Docker (for PostgreSQL)

## First-time setup

```bash
# From repo root
cp .env.example .env
cp .env.example apps/server/.env

# Next.js BFF routes (client + admin)
echo 'NEXT_PUBLIC_API_URL=http://localhost:4000/api' > apps/client/.env.local
echo 'NEST_API_URL=http://localhost:4000/api' >> apps/client/.env.local
echo 'NEXT_PUBLIC_SITE_URL=http://localhost:3000' >> apps/client/.env.local
echo 'NEXT_PUBLIC_API_URL=http://localhost:4000/api' > apps/admin/.env.local
echo 'NEST_API_URL=http://localhost:4000/api' >> apps/admin/.env.local

pnpm install
pnpm db:up

pnpm --filter @lumea/server prisma:generate
pnpm --filter @lumea/server exec prisma migrate deploy
pnpm db:seed
# equivalent: pnpm --filter @lumea/server prisma:seed
```

Seed loads admin, sample catalog, and demo fixtures (`apps/server/prisma/fixtures/demo-catalog.ts`): extra products (including an out-of-stock SKU), journal articles with galleries + recommended products, and coupons with include/exclude tag rules (`SPF15`, `NOTNEW`).

> **Note:** `pnpm db:up` requires Docker. Without Postgres, the API still boots and `/api/health` returns `database: "down"`.

## Run all apps

```bash
pnpm dev
```

| App | URL |
| --- | --- |
| Client (storefront) | http://localhost:3000 |
| Admin | http://localhost:3001 |
| API health | http://localhost:4000/api/health |

## Authentication (Phase 3)

### Seeded admin

After `prisma:seed`:

| Field | Value |
| --- | --- |
| Email | `admin@lumea.local` |
| Password | `SelfiefaceAdmin123!` |

Sign in at http://localhost:3001/login (customer accounts are rejected on the admin app).

### Customer auth

- Register: http://localhost:3000/account/register
- Sign in: http://localhost:3000/account/login
- Forgot password sends a reset link via **Amazon SES** when configured; otherwise logs the reset URL in the **NestJS server console**
- Email/password register sends a verification link the same way; login is soft-gated (`emailVerified` on session + account banner)
- **Continue with Google** on login/register (requires Google OAuth env vars below)

### Google OAuth (customers)

1. In [Google Cloud Console](https://console.cloud.google.com/) create an OAuth 2.0 Client ID (Web application).
2. Add authorized redirect URI: `http://localhost:4000/api/auth/google/callback`
3. Set in `apps/server/.env` (and root `.env` if you load it there):

```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
CLIENT_URL=http://localhost:3000
```

4. Restart the Nest server. Without these vars, `/api/auth/google` returns 503.

Flow: Google → Nest callback → one-time exchange code → Next BFF `/api/auth/google/callback` sets the refresh cookie → `/account`.

Google-only accounts have no password until they use “Forgot password”. Existing email accounts are linked when the Google email matches.

### Amazon SES (email)

Transactional + light marketing mail uses **Amazon SES only** (`@aws-sdk/client-ses`). Without the env vars below, the API boots normally and mail **no-ops** with a clear log (`[mail:noop]` / `[stock-notify] ready …`). Password reset still prints the URL to the Nest console when SES is unset or send fails.

Add to `apps/server/.env` (and root `.env` if you mirror it):

```bash
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
SES_FROM_EMAIL=noreply@your-verified-domain.com
SES_FROM_NAME=Selfieface
# Optional — new order alerts to ops
# SES_ADMIN_NOTIFY_EMAIL=ops@your-domain.com
```

| Concern | Behavior |
| --- | --- |
| From identity | Verify `SES_FROM_EMAIL` (or domain) in SES; leave sandbox to mail arbitrary recipients |
| Restock | Inventory 0→N emails `StockNotifySubscription` rows and sets `notifiedAt` on success |
| Orders | Confirmation on COD/paid finalize; shipped/delivered/cancelled on status changes (needs customer account email) |
| Marketing | `POST /api/admin/mail/marketing` (`content.update`) — admin-triggered SES send (`audience: newsletter\|explicit`, `dryRun`). Admin UI: http://localhost:3001/marketing/mail |
| Newsletter | `POST /api/newsletter/subscribe` (single opt-in + welcome mail); `POST /api/newsletter/unsubscribe` with signed `email`+`token`. Storefront footer form |
| Email logs | `EmailLog` on every send path; `GET /api/admin/mail/logs` (`content.read`); UI http://localhost:3001/marketing/email-logs |
| Local dev | Omit SES vars; check Nest logs for noop / reset / verification URLs |
| Email verification | Register sends a 24h link to `/account/verify-email?token=…`. Login is **soft-gated** (session allowed; `AuthUser.emailVerified` + account banner). Google OAuth and admins count as verified. Resend: `POST /auth/resend-verification` or authenticated `POST /auth/resend-verification/me`. |

Optional: `NEWSLETTER_UNSUBSCRIBE_SECRET` (falls back to `JWT_SECRET`) for signed unsubscribe links.

See also [PENDING_FEATURES.md](./PENDING_FEATURES.md) for optional mail follow-ups (tracking field).

### Flow

Browsers talk to Next.js `/api/auth/*` BFF routes, which set an httpOnly refresh cookie and return a short-lived access JWT. The access token is kept in React context; page reloads rehydrate via `/api/auth/refresh`.

## Catalog (Phase 4)

After migrate + seed, the storefront `/shop` shows sample Selfieface products.

**Currencies:** USD, TND, AED — visitor currency is detected from locale/timezone (cookie `lumea_currency`) and can be switched in the header. Variant prices are stored per currency (not converted at browse time).

**Languages:** English, Arabic, French — visitor language is detected from browser locale/timezone (cookie `lumea_locale`) and can be switched in the header. Catalog copy (products, categories, brands) is stored per language and returned for the active locale (falls back to English). Arabic sets `dir="rtl"`.

| Surface | URL |
| --- | --- |
| Shop | http://localhost:3000/shop |
| Product detail | http://localhost:3000/products/[slug] |
| Admin products | http://localhost:3001/catalog/products |
| Admin inventory | http://localhost:3001/catalog/inventory |
| Admin warehouses | http://localhost:3001/catalog/warehouses |

Product images upload to `apps/server/uploads/` (gitignored) and are served at `/api/media/:id`.

### Image CDN / compression

On upload, raster images (JPEG/PNG/WebP/TIFF/AVIF/BMP) are **resized** (max edge 1920px) and **compressed to WebP** (~quality 80) via `sharp`. GIFs, SVGs, videos, and other MIME types are stored as-is. If compression fails, the original buffer is kept.

Media rows always store `url = /api/media/:id` (stable IDs; existing DB URLs keep working). Optional width/height are recorded when known.

| Env | Where | Purpose |
| --- | --- | --- |
| `MEDIA_PUBLIC_BASE_URL` | `apps/server/.env` | Documented server-side CDN origin (for ops / future absolute URL helpers). Delivery rewrite is done in Next via the public var below. |
| `NEXT_PUBLIC_MEDIA_URL` | `apps/client/.env.local`, `apps/admin/.env.local` | When set (e.g. `https://cdn.example.com`), `mediaUrl()` rewrites `/api/media/:id` → `https://cdn.example.com/api/media/:id`. Unset → API host as today. |
| `NEXT_PUBLIC_MEDIA_CDN_URL` | same | Alias for `NEXT_PUBLIC_MEDIA_URL` |

Point a CDN or reverse proxy at the Nest `/api/media/*` origin (Cache-Control is already long-lived). No S3 upload in v1 — local disk + CDN in front of Nest is enough. `next/image` `remotePatterns` include localhost and any host from `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_MEDIA_URL`.

```bash
# apps/server/.env (optional documentation / future use)
# MEDIA_PUBLIC_BASE_URL=https://cdn.example.com

# apps/client/.env.local + apps/admin/.env.local
# NEXT_PUBLIC_MEDIA_URL=https://cdn.example.com
```

## Commerce (Phase 5)

- Add to bag on product pages; bag at http://localhost:3000/cart
- Checkout at http://localhost:3000/checkout — **guests welcome** (no sign-in required) or signed-in customers
- Guest carts use cookies `lumea_cart_id` + `lumea_guest_token` and merge on login
- Guests check out with **name + phone → address → delivery / cash on delivery** (no card payment)
- Signed-in customers pay with Stripe Payment Element (or simulated capture without Stripe keys)
- Totals (subtotal, discount, shipping, tax) are computed on the server in the active currency (USD / TND / AED)
- **Coupons:** apply on the bag page / bag drawer; one coupon per cart/order. Admin CRUD at http://localhost:3001/marketing/coupons
- **Product campaigns:** badges on cards + admin at http://localhost:3001/marketing/promotions (see [STOREFRONT_UX.md](./STOREFRONT_UX.md))
- **Wishlist / favorites:** sign-in required. Hearts on shop cards and PDP; header favorites drawer; page at http://localhost:3000/wishlist
- Admin store shipping settings: http://localhost:3001/catalog/settings
- **Stripe Payment Element (signed-in):** places the order, then mounts Stripe’s Payment Element. After confirm (including 3DS redirects), the client calls `POST /api/orders/:id/confirm-payment`. Unpaid card orders can resume via `GET /api/orders/:id/payment-secret`.

### Guest commerce (Phase 10)

Guests can browse `/shop` and product pages without login, keep a guest cart, and check out in short steps:

```text
Name & phone → Address → Delivery cost / Cash on delivery → Confirmation
```

- Server creates/links a **guest customer** by phone (`Customer.isGuest`, optional `userId`)
- Guest orders use **cash on delivery**: stock is reserved, payment stays `AUTHORIZED` until collected on delivery (no Stripe for guests)
- Guest confirmation uses header `x-guest-order-token` (token returned as `guestAccessToken` on the order; stored in `sessionStorage` and by order number in `localStorage`)
- Guests can reopen status later at `/orders/track` with **order number + access token** (`POST /orders/track`); footer links to Track order
- Signed-in checkout still uses Stripe (Address → Delivery → Payment → Confirmation)
- Related products: `GET /api/products/:slug/related` — shown on PDP as “Complete Your Ritual”
- Share: native share + copy link on product pages (canonical `/products/[slug]`)
- Seed attaches Unsplash product images (temporary URLs OK for local/dev)

### Stripe (optional)

Without Stripe keys, checkout still works in **simulated capture** mode (`paymentIntentId: "dev"`).

1. Create a [Stripe test API key](https://dashboard.stripe.com/test/apikeys).
2. Set on the Nest server (`apps/server/.env`):

```bash
STRIPE_SECRET_KEY=sk_test_...
```

3. Set on the storefront (`apps/client/.env.local`):

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Also mirrored in root `.env.example` as `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.

4. Restart Nest + Next client. Test card: `4242 4242 4242 4242`, any future expiry, any CVC.

Checkout flow with Stripe: Address → Place order → Payment Element → (optional 3DS) → Confirmation.

### Seeded coupons (after `prisma:seed`)

| Code | Type | Notes |
| --- | --- | --- |
| `WELCOME10` | 10% off | Min subtotal $25 / TND 75 / AED 90; **1 use per customer** |
| `LUMEA5` | Fixed | $5 / 15 TND / 18 AED off (minor units: 500 / 1500 / 1800) |

Seeded wishlist sample items for `reviewer@lumea.local` / `SelfiefaceReview123!`.

Re-run after pulling catalog migrations:

```bash
pnpm --filter @lumea/server exec prisma migrate deploy
pnpm --filter @lumea/server prisma:seed
```

### Migration (guest commerce)

```bash
pnpm --filter @lumea/server prisma:generate
pnpm --filter @lumea/server exec prisma migrate deploy
pnpm --filter @lumea/server prisma:seed
```

Migration name: `20250914230000_guest_commerce` (after `20250914220000_coupons_wishlist`)

### Migration (coupons + wishlist)

```bash
pnpm --filter @lumea/server prisma:generate
pnpm --filter @lumea/server exec prisma migrate deploy
pnpm --filter @lumea/server prisma:seed
```

Migration name: `20250914220000_coupons_wishlist`
### JWT env (server)

Set in `apps/server/.env`:

- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET` (reserved for future rotation hardening)
- `JWT_ACCESS_EXPIRES` (default `15m`)
- `JWT_REFRESH_EXPIRES_DAYS` (default `7`)
- `PASSWORD_RESET_URL_CLIENT` (default `http://localhost:3000`)

## Editorial content (Phase 7)

After migrate:

| Surface | URL |
| --- | --- |
| Storefront journal | http://localhost:3000/journal |
| Admin journal | http://localhost:3001/content/journal |
| Admin promo banners | http://localhost:3001/content/banners |

Published journal articles and active `HOME_HERO` banners (with optional start/end dates) are served from the API. The homepage uses the first active hero banner for the visitor locale, otherwise the static hero copy.

Editor role (`EDITOR`) can manage content via `content.*` permissions.

## Reviews & account (Phase 8)

After `prisma migrate deploy` and seed:

| Surface | URL |
| --- | --- |
| Account profile | http://localhost:3000/account |
| Product reviews (PDP) | Any product page, e.g. `/products/hydrating-body-lotion` |
| Admin review moderation | http://localhost:3001/reviews |
| Admin customers | http://localhost:3001/customers |

**Seeded reviewer** (optional): `reviewer@lumea.local` / `SelfiefaceReview123!` — includes one **approved** review on *Hydrating Body Lotion*.

Customer reviews are **one per product**, start as **PENDING**, and only **APPROVED** reviews appear on the storefront. Profile fields: name, phone, optional preferred locale/currency (applied to session cookies on save).

## Analytics (Phase 8)

After `prisma migrate deploy` and seed:

| Surface | URL |
| --- | --- |
| Admin dashboard widgets | http://localhost:3001/ |
| Admin analytics | http://localhost:3001/analytics |

**API** (admin JWT + `analytics.read`):

- `GET /api/admin/dashboard?days=30` — revenue by currency, paid order count, pending fulfillment, low-stock count
- `GET /api/admin/analytics?days=30&currency=USD` — full report (AOV, status breakdown, daily series, top products, low stock). Optional `currency` filters market; top-product revenue is shown when filtered.

Revenue counts orders with payment **CAPTURED** or **AUTHORIZED**, excluding **CANCELLED**. Amounts stay in each order’s currency (no cross-currency rollup). Seed creates sample orders (`LM-SEED-*`) under `reviewer@lumea.local` so the dashboard is non-empty.

Requires roles **SUPER_ADMIN**, **ADMIN**, or **MANAGER** (`EDITOR` cannot read analytics).

## Homepage merchandising, behavior & SEO (Phase 11)

After `prisma migrate deploy` and seed:

| Surface | URL |
| --- | --- |
| Homepage rails (Top / New / Incoming) | http://localhost:3000/ |
| Crawlable category pages | http://localhost:3000/shop/category/[slug] |
| Sitemap | http://localhost:3000/sitemap.xml |
| Robots | http://localhost:3000/robots.txt |
| Admin homepage rails | http://localhost:3001/marketing/merchandising |

**Rails:** `GET /api/merchandising/rails` returns `top`, `new`, and `incoming` product lists. Empty curated rails auto-rank: Top by `popularityScore`, New by `createdAt`, Incoming by products with `isIncoming`. Admin can pin products per rail (Marketing → Homepage rails). Product form has an **Incoming** flag.

**Deferred behavior:** Storefront batches search queries and product clicks in `sessionStorage`, then flushes via `navigator.sendBeacon` / `keepalive` fetch to Next BFF `POST /api/behavior/batch` → Nest `POST /api/behavior/batch` on tab hide / leave (not on every event). Server stores raw events and asynchronously updates `popularityScore` and `SearchInsight`.

**SEO:** Root `metadataBase` + Open Graph; per-page `generateMetadata` (home, shop, category, product); Product JSON-LD on PDP; `sitemap.ts` / `robots.ts`. Set `NEXT_PUBLIC_SITE_URL` (default `http://localhost:3000`) for absolute canonical / OG URLs.

### Migration (homepage merchandising + SEO)

```bash
pnpm --filter @lumea/server prisma:generate
pnpm --filter @lumea/server exec prisma migrate deploy
pnpm --filter @lumea/server prisma:seed
```

Migration name: `20250914240000_homepage_merchandising_seo` (after `20250914230000_guest_commerce`)

## Pre-production (Phase 12)

Hardening before go-live: centralized API errors, storefront error boundaries, catalog caching, advanced SEO, rate limits, and launch checklist.

### What shipped

| Area | Behavior |
| --- | --- |
| API errors | Global Nest filter returns `{ statusCode, message, error, path, timestamp }`; stacks logged server-side only (no stack leak in production) |
| Health | `GET /api/health`, `/api/health/live` (liveness), `/api/health/ready` (503 if DB down) |
| Rate limits | Auth `login` / `register` / `forgot-password` / `reset-password` (in-memory per IP) |
| CORS | `CLIENT_URL` + `ADMIN_URL`, or comma-separated `CORS_ORIGINS`; credentials enabled; `TRUST_PROXY=1` behind HTTPS proxies |
| Catalog cache | In-memory TTL (~60s) for products / rails / categories / brands; `Cache-Control` on public GETs; media `immutable` cache |
| Storefront ISR | Key pages `revalidate = 60`; `fetchApi` tags `catalog` / `homepage`; Nest invalidates + `POST /api/revalidate` when admin mutates catalog |
| SEO | hreflang via `?hl=en\|ar\|fr` (middleware sets locale cookie); Product + BreadcrumbList JSON-LD; image alts |
| Errors UI | Storefront `error.tsx` / `global-error.tsx` / `not-found.tsx`; EmptyState on shop / bag / wishlist; admin `error.tsx` |

### Env (add to `apps/server/.env` and client)

```bash
REVALIDATE_SECRET=long-random-secret
# Mirror on storefront so /api/revalidate accepts Nest callbacks:
# apps/client/.env.local → REVALIDATE_SECRET=same-value

# Production CORS (optional explicit list)
# CORS_ORIGINS=https://your-shop.com,https://admin.your-shop.com
TRUST_PROXY=1
NODE_ENV=production
```

Also set strong `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`, real `CLIENT_URL` / `ADMIN_URL` / `NEXT_PUBLIC_SITE_URL` (HTTPS), and Stripe **live** keys only when ready:

```bash
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Staging smoke tests

With API (and optionally storefront) running:

```bash
node scripts/smoke-staging.mjs
# or against staging:
API_URL=https://your-api.example/api SITE_URL=https://your-shop.example node scripts/smoke-staging.mjs
```

### Launch checklist

- [ ] Secrets rotated (JWT, `REVALIDATE_SECRET`, DB password) — never commit `.env`
- [ ] HTTPS on storefront, admin, and API (platform TLS / reverse proxy)
- [ ] CORS origins match production hostnames
- [ ] Stripe Dashboard: live mode keys, webhook endpoints (when enabled), currency support USD/TND/AED
- [ ] Postgres backups enabled (Render / provider scheduled backups)
- [ ] Health monitors on `/api/health/ready` (alert on non-200)
- [ ] Staging smoke script green
- [ ] Amazon SES: verified from address/domain, leave sandbox if mailing customers, set `SES_*` + `AWS_*` on the API
- [ ] CDN: put a CDN in front of `/api/media/*` and static Next assets (Cache-Control already set for media); set `NEXT_PUBLIC_MEDIA_URL` when using a separate media origin
- [ ] Optional: build API with `apps/server/Dockerfile`

### Render (API web service — native Node, no Docker)

This monorepo is **pnpm-only**. `npm install && npm run build` fails (`workspace:*` / broken postinstall).

1. Root Directory: repository root (`.`), not `apps/server`
2. Build Command: `bash scripts/render-build-api.sh`
3. Pre-Deploy: `bash scripts/render-migrate-api.sh`
4. Start Command: `bash scripts/render-start-api.sh`
5. Health Check Path: `/api/health/live`
6. Env: `NODE_VERSION=22`, `NODE_ENV=production`, `TRUST_PROXY=1`, plus `DATABASE_URL` (prefer Render **internal** DB URL; external needs `?sslmode=require`), `JWT_SECRET`, `CLIENT_URL`, `ADMIN_URL`, etc.

**Important:** Changing only `render.yaml` does not update an existing Render service. Paste the commands into **Settings → Build & Deploy**.

For **client** / **admin** on Render (or any host), set:

- `NEXT_PUBLIC_API_URL=https://<your-api-host>/api`
- `NEST_API_URL=https://<your-api-host>/api` (server-side login BFF; required or login returns empty/JSON errors)
- `CLIENT_URL` / `ADMIN_URL` / `CORS_ORIGINS` on the API to match your HTTPS storefront URLs

Chrome “Dangerous” / “Not secure” on login usually means the site is **HTTP** (password forms) or Safe Browsing flagged the host — serve the apps over **HTTPS** (Render does this by default on `*.onrender.com`).

Or connect the repo with the Blueprint in [`render.yaml`](../render.yaml).

### API Docker (optional — not required for Render)

```bash
docker build -f apps/server/Dockerfile -t lumea-api .
docker run --env-file apps/server/.env -p 4000:4000 lumea-api
```

No new Prisma migration for Phase 12 (caching / errors / SEO are application-level).

## Useful scripts

| Script | Description |
| --- | --- |
| `pnpm db:up` | Start Postgres via Docker Compose |
| `pnpm db:down` | Stop Postgres |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | Lint via Turborepo |
| `pnpm format` | Prettier write |
| `pnpm --filter @lumea/server prisma:seed` | Seed super admin |
| `node scripts/smoke-staging.mjs` | Staging / local API (+ optional site) smoke checks |

## Workspace packages

- `@lumea/ui` — shared design system (tokens in `@lumea/ui/styles/tokens.css`, Radix-based components)
- `@lumea/types` — shared enums and types
- `@lumea/validation` — Zod schemas
- `@lumea/utils` — helpers (`formatMoney`)
- `@lumea/config` — shared TypeScript configs
