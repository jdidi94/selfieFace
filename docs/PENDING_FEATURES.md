# Pending features & follow-ups

**Status:** backlog / TODO — items below are tracked as **TODO**, **IN PROGRESS**, or **DONE**.  
Use this as the working list for storefront, admin, reliability, and merchandising enhancements. Spec-only UX/scale work also lives in [PENDING_UX_SCALE_TASKS.md](./PENDING_UX_SCALE_TASKS.md).

**Email:** transactional + marketing mail uses **Amazon SES** (see [SETUP.md](./SETUP.md#amazon-ses-email) and `apps/server/src/mail`). Core transactional flows and email verification are wired; remaining rows below are optional follow-ups.

---

## Recently shipped

| Item | Notes |
| --- | --- |
| First-visit **currency hint** | Soft banner when currency was auto-detected; dismiss + explicit switcher hide it |
| **Sticky PDP** add-to-bag bar | Mobile sticky CTA on product detail |
| Account **order timeline** | Prefers `OrderDto.timeline` / `OrderTimelineEvent` |
| **Stock-notify subscriptions** | `StockNotifySubscription` + public/admin APIs + OOS UI; restock emails via SES when configured |
| **Guest order tracking** | Confirmation shows order # + access token; `POST /orders/track` + `/orders/track` lookup; guest cancel with token; footer link |
| **Cancel / refund policy copy** | Hint near cancel CTA on account order detail and guest track |
| **Empty search / filter CTAs** | Shop, category, and search empty states link to browse / bestsellers / clear filters |
| **Cancel/refund → stock-notify** | `restockOrderItems` triggers `onStockAvailable` after cancel/refund restock |
| **Admin brand / category edit** | Edit dialogs on catalog brands & categories (PATCH already existed) |
| **SEO / content pack** | Locale sitemap + hreflang, crumbs/JSON-LD, product/article OG images, journal markdown editor |
| **Customer address book** | Account CRUD + checkout reuse / save |
| **Idempotent checkout** | Idempotency-Key prevents duplicate orders on retry |
| **Guest checkout email** | Optional email for SES transactional mail |
| **Related / ritual rails** | Tag + ritual-partner scoring beyond same-category |
| **Admin low-stock alerts** | `StoreSettings.lowStockThreshold` (default 5); inventory Low badges; SES to `SES_ADMIN_NOTIFY_EMAIL` on threshold cross (adjust + checkout SALE) |
| **Loyalty program** | Admin toggle + rules on StoreSettings; points earn/redeem; account ledger; cancel/refund reverses ledger |
| **Bulk product tags** | Multi-select on admin products + `POST /admin/products/bulk-tags` add/remove |
| **Cart stock sync** | GET/mutations reconcile qty vs stock; `stockAdjustments` on `CartDto`; visibility refetch |
| **API-down retry states** | Shop / category / search / cart / checkout show `ErrorState` + retry (not empty catalog) |
| **Image CDN / compression** | Upload WebP compress (max edge 1920); `NEXT_PUBLIC_MEDIA_URL` rewrite; Media width/height; next/image remotePatterns |
| **SES transactional mail** | Order confirm/ship/deliver/cancel, restock, password reset, marketing send, low-stock admin notify |
| **Email verification** | Register → SES verify link; soft-gate (login allowed + account banner); Google OAuth auto-verified |
| **Newsletter / EmailLog / marketing UI** | `NewsletterSubscriber` + public subscribe/unsubscribe; `EmailLog` on SES path; admin `/marketing/mail` + `/marketing/email-logs` |
| **Multi-warehouse inventory** | `Warehouse` + `WarehouseStock`; aggregate `ProductVariant.stock`; default-first checkout allocation + `OrderItemAllocation`; admin warehouses + inventory transfer |

---

## Storefront / customer

| Feature | Status | Notes |
| --- | --- | --- |
| Guest order tracking | DONE | Phone-keyed guests; track by order number + `guestAccessToken` (no email/magic link yet) |
| Refund / cancel policy copy near cancel | DONE | Account + guest track cancel CTAs |
| Stronger empty-search CTAs | DONE | Empty search/filter states with shop / bestsellers / clear CTAs |
| Customer address book | DONE | CRUD `GET/POST/PATCH/DELETE /customers/me/addresses`; checkout reuse + optional save; account `/account/addresses` |
| Related products / ritual rules | DONE | Tag overlap + ritual partner tags + popularity scoring on PDP related rail |
| Loyalty program | DONE | StoreSettings toggle + rules; earn on CAPTURED (card) / AUTHORIZED (COD); redeem at cart/checkout; account ledger |
| Minimal checkout address | DONE | Faster UX: name, phone, street, city, country; line2 / region / postal hidden on storefront; postal optional server-side |
| Cookie-only currency (no switcher) | DONE | Removed footer switcher, hint banner, profile currency control; currency from cookie / geo only |
| Product packs / bundles | DONE | Schema/API, Top packs rail, shop Packs chip/`kind=PACK`, pack badge + savings on cards, PDP contents compare |

### Packs (how it works — phased)

1. **Model:** `Product.kind` = `PRODUCT` \| `PACK`. Packs reuse category, brand, tags, images, status, translations, variants/prices.
2. **Components:** `PackComponent` links a pack product → existing `ProductVariant` + qty. Compare price = sum of component unit prices × qty; sell price = pack variant price.
3. **Stock:** Pack availability derived from component stock (`min(floor(stock/qty))`); pack variant stock mirrored for cart/checkout deductions on components.
4. **Storefront:** distinct pack card (contents + savings), `/packs/[slug]` detail, home **Top packs** rail (`MerchandisingRailKind.TOP_PACKS`), shop filter `kind=pack`.
5. **Admin:** create/edit pack like a product + component picker; enable/disable via product status.
6. **Cart:** one line for the pack variant (same cart path as products).

---

## SEO / content

| Feature | Status | Notes |
| --- | --- | --- |
| Richer journal editor | DONE | Admin markdown toolbar (H2/H3, bold, italic, link); storefront safe render; bare URL embeds kept |
| Breadcrumbs + Product JSON-LD | DONE | Locale-prefixed crumbs on PDP/shop/category/journal; Product JSON-LD on PDP; ItemList on shop/category/related/recommended |
| Sitemap / hreflang audit (`/en` `/ar` `/fr`) | DONE | Locale-prefixed sitemap entries + `alternates.languages`; `seoAlternates` / canonicals use path prefixes |
| Open Graph images per product / article | DONE | Product + journal `generateMetadata` OG + Twitter images from primary/cover media |

---

## Admin

| Feature | Status | Notes |
| --- | --- | --- |
| Brand / category edit polish | DONE | Edit UX for names/translations (+ brand image); create/delete unchanged |
| Low-stock alerts | DONE | Settings threshold (default 5); inventory badges; SES on cross via adjust + checkout SALE |
| Bulk tags | DONE | Multi-select + `POST /admin/products/bulk-tags` add/remove |
| Merchandising DnD polish | DONE | ProductPicker drag + Top/Bottom; Up/Down kept |
| Loyalty settings | DONE | Toggle + earn/redeem rules on catalog settings; balance on customer detail |
| Packs admin | DONE | Kind + searchable product/variant component picker on product form; Top packs merchandising rail |
| Marketing mail + email logs | DONE | Compose at `/marketing/mail` (newsletter or explicit, dry-run); logs at `/marketing/email-logs` |
| Multi-warehouse inventory | DONE | Warehouses CRUD; inventory by warehouse + transfer; order fulfillment warehouses |

---

## Reliability / commerce

| Feature | Status | Notes |
| --- | --- | --- |
| Idempotent checkout | DONE | `Idempotency-Key` / body key; unique on `Order`; safe replay returns existing order |
| Cart sync on stock drop | DONE | Reconcile on cart map; clamp/remove; `stockAdjustments`; client visibility refetch |
| API-down retry states | DONE | Shop/category/search/cart/checkout distinguish Nest-down vs empty + retry CTA |
| Loyalty earn / redeem | DONE | Earn on payment commit (CAPTURED / COD AUTHORIZED); redeem debited at order create; reverse on cancel/refund |

### Loyalty rules (how it works)

- **Toggle:** `StoreSettings.loyaltyEnabled` (admin Catalog → Settings).
- **Earn:** `floor((subtotal − discount) / 100) × loyaltyPointsPerMajorUnit` when the order becomes committed — **card: `CAPTURED`**, **COD: `AUTHORIZED`**. Guests do not earn.
- **Redeem:** cart `loyaltyPointsToRedeem`; discount = points × `loyaltyPointValueMinor`, capped by optional `loyaltyMinOrderMinor` and `loyaltyMaxRedeemBps`. Points are debited when the order is created; restored on cancel/refund.
- **Signup bonus:** granted once when the customer’s `LoyaltyAccount` is first created (if enabled and bonus > 0).
- **APIs:** `GET /loyalty/config`, `GET /loyalty/me`, `POST/DELETE /cart/:id/loyalty`. Redeem rejected when disabled.

---

## Media / infra

| Feature | Status | Notes |
| --- | --- | --- |
| Image CDN / compression | DONE | Compress on upload (sharp → WebP, max edge 1920, q≈80; fallback to original). DB urls stay `/api/media/:id`. Set `NEXT_PUBLIC_MEDIA_URL` (alias `NEXT_PUBLIC_MEDIA_CDN_URL`) for CDN rewrite; optional `MEDIA_PUBLIC_BASE_URL` on server docs. Media `width`/`height` when known. No multi-variant / S3 in v1. |

---

## Mail (SES) — done

| Feature | Status | Notes |
| --- | --- | --- |
| SES core (`MailModule` / `SesMailService`) | DONE | Env-gated; no-op / clear log when unset locally |
| Restock / back-in-stock email | DONE | On 0→N via inventory adjust **and** cancel/refund restock; auto-mark notified on send; admin mark-notified kept |
| Order confirmation (+ optional admin notify) | DONE | Registered customers + guests with captured email; guest CTA → `/orders/track` |
| Shipped / delivered | DONE | On admin status transitions; tracking from status `note` when present |
| Order cancelled | DONE | On cancel paths when customer email exists |
| Password reset via SES | DONE | Replaces console-only link when SES configured |
| Marketing send path | DONE | `POST /admin/mail/marketing` admin-triggered SES send (not a full ESP) |
| Email verification (auth) | DONE | Register sends verify link; soft-gate login (shop allowed); Google/admin treated verified |
| Cancel/refund restock → stock-notify | DONE | Wired in `OrdersService` after restock |
| Guest checkout email capture | DONE | Optional email on guest checkout → `Customer.email`; mail helper fallback |
| Dedicated tracking number field | TODO | Today tracking can live in status `note` |
| Newsletter list / EmailLog tables | DONE | `NewsletterSubscriber` + `EmailLog`; footer signup; admin marketing compose + logs |

---

## Later

| Feature | Status | Notes |
| --- | --- | --- |
| Wishlist share | Later | |
| Multi-warehouse inventory | DONE | See below |

### Multi-warehouse inventory (how it works)

1. **Model:** `Warehouse` + `WarehouseStock` (per variant × warehouse). `ProductVariant.stock` is the **denormalized sum across active warehouses** (storefront / cart / checkout stay aggregate-based).
2. **Migration:** Existing rows land on default warehouse `main` (`wh_main_default`). Seed also creates `outlet` and splits sample stock.
3. **Storefront availability:** Aggregate sellable qty (sum of active warehouses). No customer warehouse picker.
4. **Checkout allocation:** Default warehouse first, then other active warehouses by name; a line may split. Recorded on `OrderItemAllocation`. Packs deduct component stock the same way (no pack-line allocations).
5. **Cancel / refund restock:** Returns stock to the warehouses that fulfilled the line; if no allocations (legacy), uses the default warehouse.
6. **Low-stock / stock-notify:** Still based on **aggregate** `ProductVariant.stock` (unchanged thresholds + SES).
7. **Admin:** Catalog → Warehouses CRUD; Inventory shows per-warehouse qty + adjust / transfer; order detail shows fulfillment warehouses.
8. **Remaining gaps:** Reserved qty / soft holds; pack order-line allocations; preferred warehouse by shipping zone; admin delete warehouse; reserved stock for pending unpaid orders.

---

## Related docs

- [PENDING_UX_SCALE_TASKS.md](./PENDING_UX_SCALE_TASKS.md) — admin validation, humanized errors, shop filters, journal media, large-catalog loading
- [STOREFRONT_UX.md](./STOREFRONT_UX.md) — currency hint, sticky PDP, timeline, stock-notify
- [SETUP.md](./SETUP.md) — SES env vars and local no-op behavior
- [FEATURES.md](./FEATURES.md) — phased product backlog
