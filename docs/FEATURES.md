# Features — Selfieface

Phased backlog aligned with [../readme.md](../readme.md) development phases. Priority tags:

| Tag | Meaning |
| --- | --- |
| **P0** | Required for the first sellable slice |
| **P1** | Soon after MVP; high value |
| **Later** | Deferred until core commerce is stable |

Cross-cutting markets (from day one of foundation, then wired through catalog/commerce):

- **Languages:** Arabic, English, French (RTL for Arabic)
- **Currencies:** USD, TND, AED — shown by visitor region / market

---

## Phase 1 — Foundation

| Area | Feature | Priority |
| --- | --- | --- |
| Server | NestJS app, health check, env config | P0 |
| Server | Prisma + PostgreSQL connection | P0 |
| Client | Next.js storefront shell | P0 |
| Admin | Next.js admin shell | P0 |
| Shared | `packages/ui`, `types`, `validation`, `config`, `utils` | P0 |
| Shared | Locale model: `ar`, `en`, `fr` | P0 |
| Shared | Currency model: USD, TND, AED | P0 |
| Infra | pnpm + Turborepo + Docker Compose (Postgres) | P0 |
| Infra | ESLint, Prettier, TypeScript strict | P0 |

---

## Phase 2 — Design system

| Area | Feature | Priority |
| --- | --- | --- |
| Shared UI | Colors, typography, spacing tokens (Selfieface brand) | P0 |
| Shared UI | Button, Input, Select, Dialog, Tabs, Badge, Toast | P0 |
| Shared UI | Card, Table, Pagination, Dropdown, Avatar, Skeleton, Tooltip, Form | P0 |
| Shared UI | Empty / loading / error states | P0 |
| Shared UI | ProductCard, ProductImage, ProductPrice, ProductBadge, Rating | P1 |
| Shared UI | RTL layout support for Arabic | P0 |
| Shared UI | `ProductPrice` formats by active currency (USD / TND / AED) | P0 |
| Client | Storefront navigation + footer chrome | P0 |
| Client | Language switcher (Arabic, English, French) | P0 |
| Client | Detect region on visit; default language + currency | P0 |
| Admin | Admin shell navigation | P0 |

---

## Phase 3 — Authentication

| Area | Feature | Priority |
| --- | --- | --- |
| Server | Register, login, logout, refresh tokens | P0 |
| Server | Password hashing; password reset; email verification | P0 |
| Server | Roles + permission guards | P0 |
| Client | Customer register / login / account session | P0 |
| Admin | Admin login + role-gated routes | P0 |
| Server | Google OAuth (sign-in / sign-up, link to customer account) | P0 |
| Client | Sign in with Google on register / login | P0 |
| Server | Guest session (optional cart) | P1 |

---

## Phase 4 — Catalog

### Server

| Feature | Priority |
| --- | --- |
| Products + variants CRUD | P0 |
| Categories, brands CRUD | P0 |
| Ingredients + product links | P1 |
| Collections | P1 |
| Product images / media (S3-compatible) | P0 |
| Inventory + movements | P0 |
| Public product list/detail by slug | P0 |
| Search + filters API | P0 |
| Multi-currency prices on variants (USD, TND, AED) | P0 |
| Locale-aware product / category copy (`ar` / `en` / `fr`) | P1 |

### Client

| Feature | Priority |
| --- | --- |
| Product listing | P0 |
| Search + filters | P0 |
| Product detail page (gallery, variants, education sections) | P0 |
| Prices shown in visitor region currency | P0 |
| Catalog copy in active language | P1 |
| Category / brand pages | P1 |
| Ingredient pages | P1 |

### Admin

| Feature | Priority |
| --- | --- |
| Product CRUD (with variants) | P0 |
| Category CRUD | P0 |
| Brand CRUD | P1 |
| Inventory management | P0 |
| Media management | P0 |
| Ingredients / collections admin | P1 |
| Per-market pricing (USD / TND / AED) | P0 |
| Product / category translations (ar / en / fr) | P1 |

---

## Phase 5 — Commerce

### Server

| Feature | Priority |
| --- | --- |
| Cart + cart items | P0 |
| Checkout: addresses, shipping quote | P0 |
| Coupons (one per order) | P1 |

See also **[MARKETS.md](./MARKETS.md#coupons-per-market)** for per-market coupon capabilities (percent/fixed, product scope include/exclude, min order, usage limits, dates).
| Order creation (server totals) | P0 |
| Stripe payment intent / capture | P0 |
| Wishlist | P1 |
| Cart / checkout totals in active currency (USD / TND / AED) | P0 |
| Multi-currency conversion / pricing rules for checkout | P1 |

### Client

| Feature | Priority |
| --- | --- |
| Add to bag | P0 |
| Cart page | P0 |
| Checkout flow (address → shipping → payment → confirmation) | P0 |
| Cart and checkout amounts in region currency | P0 |
| Wishlist | P1 |
| Saved addresses | P1 |

### Admin

| Feature | Priority |
| --- | --- |
| Coupon CRUD | P1 |
| Shipping / store settings | P0 |
| Store markets: enabled languages + currencies by region | P0 |

Customer flow (P0):

```text
Product → Add to Bag → Cart → Checkout → Address → Shipping → Payment → Order Confirmation
```

---

## Phase 6 — Orders

| Area | Feature | Priority |
| --- | --- | --- |
| Admin | Order list + filters by status | P0 |
| Admin | Order detail (items, customer, payment, shipping) | P0 |
| Admin | Order timeline + status updates | P0 |
| Admin | Cancel / refund architecture | P1 |
| Admin | Order amounts shown in order currency (USD / TND / AED) | P0 |
| Client | Account order list + detail / tracking | P0 |
| Server | Status transition validation + stock restock on cancel | P0 |
| Server | Persist order currency + locked amounts at checkout | P0 |

---

## Phase 7 — Editorial content

| Area | Feature | Priority |
| --- | --- | --- |
| Server/Admin | Journal articles CRUD | P1 |
| Server/Admin | Routines linked to products | P1 |
| Server/Admin | Ingredient education content | P1 |
| Server/Admin | Homepage editor (colors, logo, hero/section images) | P1 |
| Server/Admin | Ad / promo banners (CRUD, scheduling, placement) | P1 |
| Server/Admin | Homepage / campaign content blocks | P1 |
| Server/Admin | Editorial + banner copy in ar / en / fr | P1 |
| Client | Journal, routines, ingredient education routes | P1 |
| Client | Homepage renders admin-published branding and banners | P1 |
| Client | Content → product → add to bag paths | P1 |

---

## Phase 8 — Reviews and customer

| Area | Feature | Priority |
| --- | --- | --- |
| Server/Client | Product reviews + ratings | P1 |
| Admin | Review moderation | P1 |
| Client | Account profile management | P0 |
| Client | Preferred language / currency on account (optional override) | P1 |
| Admin | Customer list + detail | P1 |
| Admin | Customer segments | Later |
| Server | Analytics endpoints (revenue, orders, products) | P1 |
| Admin | Analytics dashboard | P1 |
| Admin | Analytics filterable / reportable by market currency | Later |

---

## Phase 10 — Guest commerce, sharing, related products & seed

| Area | Feature | Priority |
| --- | --- | --- |
| Client | Guests can browse full catalog (products visible without login) | P0 |
| Server | Guest session for cart without auth | P0 |
| Client | Guest checkout in small easy steps (phone → address → delivery ) | P0 |
| Server | Guest checkout (no auth):name &&  phone number, address, delivery cost | P0 |
| Server | Related products (same category / brand / collection) | P1 |
| Client | Related products on product detail (“Complete Your Ritual”) | P1 |
| Server | Shareable product links (canonical slug URLs for social sharing) | P1 |
| Client | Share product to social media (native share + copy link) | P1 |
| Infra | Seed data: catalog with images (Unsplash or similar temporary URLs OK) | P0 |

Guest checkout flow (P0) — no account required:

```text
Browse catalog → Add to Bag → Cart → Checkout
  → name && Phone number
  → Delivery address
  → Delivery cost / Cash on delivery
  → Order Confirmation
```

---

## Phase 11 — Homepage merchandising, deferred behavior & SEO

| Area | Feature | Priority |
| --- | --- | --- |
| Client | Homepage section: Top products | P1 |
| Client | Homepage section: New products | P1 |
| Client | Homepage section: Incoming products | P1 |
| Server/Admin | Curate or auto-rank top / new / incoming product rails | P1 |
| Client | Collect user behavior locally (search queries, product clicks) | P1 |
| Client | Flush behavior batch to server on leave (visibility / beforeunload / beacon) — not on every event | P1 |
| Server | Ingest batched behavior events; update popularity / search insights asynchronously | P1 |
| Client | SEO basics: meta title/description, Open Graph, canonical URLs | P1 |
| Client/Server | SEO search / discoverability links (sitemap, robots, structured data, crawlable product & category URLs) | P1 |

Behavior update rule:

```text
User browses (search, clicks)
  → Collect events in the frontend (batch)
  → Do NOT hit the server on every action
  → On leave / tab hide / session end → send batch to server
  → Server updates rankings / insights asynchronously
```

---

## Phase 12 — Optimization, caching, errors, advanced SEO & pre-production

Pre-production hardening before go-live. Do this after core commerce is stable.

| Area | Feature | Priority |
| --- | --- | --- |
| Client/Server | Performance optimization (bundle size, images, lazy load, DB query review) | P1 |
| Server | Response / catalog caching (HTTP cache headers,in-memory where useful) | P1 |
| Client | Cache product list / detail / homepage rails sensibly; invalidate on admin updates | P1 |
| Server | Centralized error handler (consistent API errors, logging, no stack leaks in prod) | P0 |
| Client | Global error boundaries + friendly error / empty states | P0 |
| Client/Server | Advanced SEO: hreflang (ar / en / fr), JSON-LD Product / BreadcrumbList, image alt, SSR/ISR for key pages | P1 |
| Infra | Pre-production setup: env secrets, HTTPS, CORS, rate limits, Stripe live keys checklist | P0 |
| Infra | Pre-production: backups, health checks, monitoring / alerts, staging smoke tests | P0 |
| Infra | Pre-production: CDN for images/assets, production Docker / deploy config | P1 |

Suggested order before production:

```text
Optimize hot paths + images
  → Add caching (API + pages + assets)
  → Harden error handling + logging
  → Advanced SEO pass
  → Staging smoke tests
  → Secrets / HTTPS / payments checklist
  → Go live
```

---

## Explicit Later (platform-wide)

Do not schedule in early sprints:

- Loyalty / points
- Live chat
- Marketplace sellers
- AR try-on
- Native mobile apps
- Subscriptions / auto-replenish
- Advanced cash on delivery (admin cash collection UI, partial COD, carrier COD APIs)
- Advanced personalization

---

## First sellable slice (definition of done)

P0 items through Phase 6 that enable:

1. Admin creates products, variants, stock, and images (with USD / TND / AED prices)
2. Customer browses in region language (ar / en / fr) and currency
3. Customer adds to bag, checks out with Stripe test payment in that currency
4. Customer sees order in account
5. Admin processes order status through Shipped

Phase 10 extends this with guest browse/checkout, social share links, related products, and richer seeded catalog imagery.

Phase 11 adds homepage top / new / incoming rails, deferred behavior analytics, and SEO search links.

Phase 12 is the pre-production pass: optimization, caching, error handling, advanced SEO, and launch setup.

---

## Related documents

- [PRODUCT_VISION.md](./PRODUCT_VISION.md)
- [BUSINESS_RULES.md](./BUSINESS_RULES.md)
- [USER_PERSONAS.md](./USER_PERSONAS.md)
- [BRAND_PHILOSOPHY.md](./BRAND_PHILOSOPHY.md)
- [STOREFRONT_UX.md](./STOREFRONT_UX.md) — product cards, bag/favorites drawers, shop filters, promotions
