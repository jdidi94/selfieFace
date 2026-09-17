# Storefront UX overhaul

Spec for the P0 storefront experience: richer product cards, bag/favorites side panels, home rails + shop filters, and end-to-end promotions (campaign badges + coupon codes).

## Locked decisions

1. **Promotions = both** — product-level sale/campaign badges **and** cart coupon codes.
2. **Favorites = login required** — heart and favorites drawer require a customer session; guests are sent to login (`?next=` preserves intent). Side panel from the header is preferred; `/wishlist` remains a deep link / fallback.
3. **Load 3 first = both** — home product rails initially show **3 products**; brand filter lists **3 brands** first with expand for more.

## Scope (P0)

| Area | In scope |
| --- | --- |
| Product cards | Rating when available; labels (Incoming, Promotion, Top rated, …); brand name + photo; qty stepper + Add to bag; favorite heart (login-gated); shaped Selfieface CTAs |
| Side panels | Bag drawer from header + after add (no forced `/cart` nav); Favorites drawer from header (login-gated); same qty / favorite affordances on PDP as on card |
| Home + shop | Categories prominent → shop/category with expandable filter panel; filters: price, rating, brands (3+expand), recommended, incoming, promotion; rails load 3 then expand; pagination preserves filters via URL |
| Promotions | Admin create/manage product campaigns (+ existing coupons); client tags, promo visibility, rails/sections as needed |
| Polish | Drawer empty states, mobile filter panel, Apply filters, i18n en/ar/fr, dark mode, responsive navbar coexistence |

Out of scope for this pass: guest wishlist, redesign of full checkout, new payment methods.

## URL filter / pagination contract

Shop listing (`/shop` and category deep links that land on filtered shop) uses **GET query params**. Pagination must re-emit the same filter keys (never drop filters when changing `page`).

| Param | Type | Meaning |
| --- | --- | --- |
| `q` | string | Text search |
| `category` | slug | Category filter |
| `brand` | slug | Single brand (UI may expand brand list; selection is one slug for P0) |
| `minPrice` | int | Min price in **minor units** of active currency |
| `maxPrice` | int | Max price in minor units |
| `minRating` | number | Minimum average rating (e.g. `4`) |
| `recommended` | `1` / omit | Prefer / filter recommended (popularity / merchandising) |
| `incoming` | `1` / omit | Incoming products |
| `promotion` | `1` / omit | Products in an active campaign **or** with compare-at sale price |
| `page` | int ≥ 1 | Page index |
| `pageSize` | int | Optional; default `12` (API max `48`) |

**Restore rule:** Returning to “all products” shop (`/shop` without clearing params) keeps the current query string. Clearing filters is explicit (Clear / reset control), not implicit navigation from the bag drawer.

Category chips on home navigate to `/shop?category={slug}` (or `/shop/category/{slug}` with the same filter panel available). Extra filters append to the query string.

## Promotion admin → client flow

### Data model

- **Coupons** (existing): cart-level codes (`Coupon`, redemptions). Admin: `/marketing/coupons`.
- **Campaigns** (new): `Promotion` + `PromotionProduct` join. Fields: name, slug, display `tag`, optional description, `startsAt` / `endsAt`, `isActive`, linked products.
- **Brand photo** (new): `Brand.imageUrl` (URL string; admin-editable) for card brand row.
- **Sale price** (existing): `VariantPrice.compareAtAmount` still drives strikethrough; also contributes to the **Promotion** label when no campaign is attached.

### Admin

- Manage campaigns under Marketing (alongside coupons).
- Attach products to a campaign; toggle active window.
- Brands: set `imageUrl` when editing a brand.

### API / client

- List/detail product DTOs include brand `imageUrl`, `labels[]` (computed), `defaultVariantId`, `isPromotion`, `isTopRated`, and campaign tag when active.
- Public list accepts the filter params above.
- Home may expose a promotion rail/section when active campaign products exist.
- Cards render campaign/sale tags; coupons remain applyable in bag drawer + `/cart`.

### Label computation (client-facing)

| Label | Rule |
| --- | --- |
| Incoming | `product.isIncoming` |
| Promotion | Active campaign membership **or** `compareAtFrom > priceFrom` |
| Top rated | `averageRating >= 4` and `reviewCount >= 1` |
| Out of stock | Derived `!inStock` (when shown) |

## Side panels

- Shared **sheet/drawer** pattern (Radix Dialog–based), RTL-aware (`end` edge).
- **Bag:** open from header bag icon; open after successful Add to bag; qty update / remove; optional coupon; CTA to full `/cart` + checkout; empty state.
- **Favorites:** open from header heart when logged in; guests → `/account/login?next=/wishlist` (or open panel after login). List wishlist items; remove; empty state. `/wishlist` page kept.
- Panels coexist with sticky header + mobile nav (higher z-index than header chrome).

## Product card anatomy

```
┌─────────────────────────────┐
│ [labels…]          [♡]      │
│                             │
│         product image       │
│                             │
├─────────────────────────────┤
│ [brand photo] Brand name    │
│ Product name                │
│ ★★★★☆ (when rating exists)  │
│ Price  (compare-at)         │
│ [ − qty + ]  [ Add to bag ] │
└─────────────────────────────┘
```

- CTAs use Selfieface tokens (warm neutrals + plum accent); avoid generic neon purple/indigo AI chrome.
- Favorite is login-gated; Add to bag works for guests (existing cart guest token).

## Home rails

- `GET /merchandising/rails?limit=3` (or client slice) for initial view.
- Each rail: title + up to 3 cards + **See all / expand** to reveal remaining or link to filtered shop.
- Categories remain prominent above or beside rails and deep-link into shop with filters.

## Filter panel UX

- Expandable / resizable panel on shop (desktop sidebar or collapsible; mobile sheet/drawer).
- Brands: show first **3**, “Show more” expands.
- **Apply filters** submits GET with all params; pagination links preserve them.

## i18n / a11y / theme

- New copy in `apps/client/lib/messages.ts` for `en` / `ar` / `fr`.
- Dark mode: surfaces, borders, drawer overlay use existing CSS variables.
- Icon buttons need accessible labels; drawers trap focus via Dialog primitives.

## High-ROI storefront polish (shipped)

### First-visit currency hint

- Soft banner under the header when currency was **auto-detected** (`lumea_currency_source=auto`) and the visitor has not dismissed the hint.
- Shows current currency, short copy, inline `CurrencySwitcher`, and dismiss.
- Dismiss persisted in `localStorage` (`lumea_currency_hint_dismissed`) and a matching cookie. Explicit currency choice (footer/header switcher) sets source to `explicit` and hides the banner.

### Sticky mobile Add to bag (PDP)

- On small screens, `ProductVariantPicker` shows a fixed bottom bar: price + Add to bag (or out-of-stock + notify form).
- Desktop keeps the inline qty stepper + CTA; sticky bar is `md:hidden`.

### Account order status timeline

- `/account/orders/[id]` renders `OrderStatusTimeline`: Pending → Processing → Shipped → Delivered, or Pending → Cancelled.
- Prefers `OrderDto.timeline` (`OrderTimelineEvent` from the API); falls back to current `status` + `createdAt` when events are sparse.
- Labels localized in `messages.ts` (en / ar / fr).

### Back-in-stock notify

| Layer | Detail |
| --- | --- |
| Model | `StockNotifySubscription` (migration `20250915310000_stock_notify`) |
| Public API | `POST /stock-notify` (optional JWT — signed-in uses account email; guests send `email`) |
| Admin API | `GET /admin/stock-notify`, `PATCH /admin/stock-notify/:id/notified` (`inventory.read` / `inventory.update`) |
| Admin UI | Catalog → **Stock alerts** |
| Storefront | PDP OOS + product card OOS (“Notify me”) |

**SES restock emails** when Amazon SES is configured (`AWS_REGION`, credentials, `SES_FROM_EMAIL`). On inventory 0 → positive, pending subscribers are emailed and auto-marked notified. If SES is unset, the server logs ready recipients and ops can still mark **Notified** in admin.

## Leftovers / follow-ups (non-blocking)

- Multi-brand multi-select filter.
- Persist drawer-open state across routes.
- Guest favorites with merge-on-login.
- Dedicated homepage “Promotions” merchandising rail kind in admin (beyond campaign-driven section).
- Brand image upload via Media library (P0 uses URL string).
- Back-in-stock: guest checkout email capture for transactional mail.

## Related docs

- [SETUP.md](./SETUP.md) — migrate/seed after schema changes
- [FEATURES.md](./FEATURES.md) — phased backlog
- [BUSINESS_RULES.md](./BUSINESS_RULES.md) — commerce rules
