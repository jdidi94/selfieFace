# Pending UX & Scale Tasks

**Status:** specification only — **no wiring in this pass**.  
Implementation PRs come later, in the order listed under [Wiring order](#wiring-order).

This backlog covers admin form validation, humanized API errors, storefront search/filters/footer, journal media, and catalog loading at ~1000+ products.

---

## Locked defaults

| Concern | Decision |
| --- | --- |
| Pagination | Offset `page` + `limit` (align with public products API) |
| Search debounce | ~300ms (lazy; do not hit API on every keystroke) |
| Sort | `sort=price\|name` + `order=asc\|desc` |
| Contact / social | Stored on `StoreSettings` (admin-editable), not hard-coded env |
| Shared validation | Prefer `@lumea/validation` Zod schemas on admin client when a server schema already exists |

---

## 1. Admin form validation

**Status:** `DONE`

### Goal

Every admin create/edit/save form validates on the client before submit, with field-level human messages. No silent early-returns.

### Forms to cover

| Area | Touchpoint |
| --- | --- |
| Login | `apps/admin/app/login/page.tsx` |
| Product create/edit | `apps/admin/components/product-form.tsx` |
| Categories | `apps/admin/app/(dashboard)/catalog/categories/page.tsx` |
| Brands | `apps/admin/app/(dashboard)/catalog/brands/page.tsx` |
| Inventory | `apps/admin/app/(dashboard)/catalog/inventory/page.tsx` |
| Warehouses | `apps/admin/app/(dashboard)/catalog/warehouses/page.tsx` |
| Store settings | `apps/admin/app/(dashboard)/catalog/settings/page.tsx` |
| Promotions / campaigns | `apps/admin/app/(dashboard)/marketing/promotions/page.tsx` |
| Coupons | `apps/admin/app/(dashboard)/marketing/coupons/page.tsx` |
| Merchandising | `apps/admin/app/(dashboard)/marketing/merchandising/page.tsx` |
| Banners | `apps/admin/app/(dashboard)/content/banners/page.tsx` |
| Journal list / edit | `apps/admin/app/(dashboard)/content/journal/page.tsx`, `…/journal/[id]/page.tsx` |
| Order actions | `apps/admin/app/(dashboard)/orders/[id]/page.tsx` |
| Reviews | `apps/admin/app/(dashboard)/reviews/page.tsx` |

### Acceptance

- [x] Required fields show inline errors before network call
- [x] Where a Zod schema exists in `packages/validation`, admin reuses it (or a thin client wrapper)
- [x] Failed saves still show API humanized messages (see §2)
- [x] No `if (!x) return` without user-visible feedback

---

## 2. Humanized API errors (client + admin)

**Status:** `DONE`

### Goal

All clients understand validation and business errors without reading Zod keys or raw Nest payloads.

### Touchpoints

- `apps/server/src/common/filters/all-exceptions.filter.ts`
- `apps/admin/lib/api.ts` (`adminFetch`)
- `apps/client/lib/api.ts` (`fetchApi` / `authFetch`)

### Acceptance

- [x] Error body always includes a readable `message` string
- [x] Optional structured `fieldErrors` with human labels (e.g. `startsAt` → “Start date”)
- [x] Field→label map in the server filter (or shared util) for common Zod paths
- [x] Admin and storefront API helpers parse `message` / `fieldErrors` the same way
- [x] No UI shows only “An unexpected error occurred” for known 400 validation failures

---

## 3. Storefront price filter (min / max slider)

**Status:** `DONE`

### Goal

Price filtering uses a dual-range slider (major currency units) while keeping existing `minPrice` / `maxPrice` query params.

### Touchpoints

- `apps/client/components/shop-filter-panel.tsx`
- `apps/client/lib/shop-filters.ts`
- `productListQuerySchema` / `listPublic` in server products (already support min/max)

### Acceptance

- [ ] Dual-range slider for min and max price
- [ ] Catalog price bounds loaded once and used to clamp the slider
- [ ] Values sync to URL query params
- [ ] Works per active currency / market

---

## 4. Footer contact & social

**Status:** `DONE` (run `prisma migrate deploy` for new StoreSettings columns)

### Goal

Footer exposes WhatsApp, Facebook, Instagram, phone, and email from store settings.

### Touchpoints

- Prisma / `StoreSettings` + `storeSettingsUpdateSchema`
- Admin: `apps/admin/app/(dashboard)/catalog/settings/page.tsx`
- Storefront: `apps/client/components/storefront-footer.tsx`

### Acceptance

- [ ] Settings fields: WhatsApp, Facebook, Instagram, phone, email
- [ ] Footer renders only non-empty links/contacts
- [ ] Admin can edit values; empty means hidden on storefront

---

## 5. Journal media uploads (photos + videos)

**Status:** `DONE` (paste-ID fallback retained)

### Goal

Journal articles upload cover/media (images and videos) instead of pasting a media ID only.

### Touchpoints

- Reuse `POST /admin/media` (`apps/server/src/media/…`)
- Admin journal edit: `apps/admin/app/(dashboard)/content/journal/[id]/page.tsx`
- Storefront journal cover/detail pages

### Acceptance

- [ ] Upload UI for images and allowed video MIME types
- [ ] Preview on admin after upload
- [ ] Cover (and any gallery) renders on storefront
- [ ] Paste-ID remains optional fallback or is removed once upload works

---

## 6. Separated lazy search + Asc / Desc sort

**Status:** `DONE`

### Goal

Search is a dedicated storefront surface (not only the shop sidebar), with lazy debounced queries and explicit Asc/Desc sort.

### Touchpoints

- New or dedicated search route/UI under `apps/client`
- `productListQuerySchema` + `listPublic` (extend beyond hardcoded sort)
- Shop filter panel / header entry point

### Acceptance

- [ ] Dedicated search UI separate from full shop filter chrome where appropriate
- [ ] `q` is debounced (~300ms); no request per keystroke
- [ ] Sort controls: `sort=price|name` and `order=asc|desc`
- [ ] Server honors sort/order; results paginate

---

## 7. Product section: filters + tags; scalable loading

**Status:** `DONE`

### Goal

Product listing always thinks in pages (client and admin). Shop product section always exposes filters **and** tags. Admin catalog stays usable at ~1000+ SKUs.

### Touchpoints

- Storefront: `apps/client/app/shop/page.tsx`, `shop-product-grid.tsx`, `shop-filter-panel.tsx`
- Admin list: `apps/admin/app/(dashboard)/catalog/products/page.tsx`
- API: `GET /products` (public), `GET /admin/products` (`listAdmin` must page)

### Acceptance

- [x] Shop product section always shows filters **and** tags (promotions/tags as first-class filters)
- [x] Client product lists paginate or lazy-load — never load full catalog in one shot
- [x] `GET /admin/products` supports `page`, `limit`, search, and filters server-side
- [x] Admin products UI uses shared Pagination; no full-table fetch for 1000+ rows
- [x] Loading states while pages fetch

---

## Wiring order

Implement later in this sequence (dependencies first):

1. **Humanized API errors** (§2) — unblocks clear form feedback everywhere  
2. **Admin form validation** (§1) — uses humanized API + client Zod  
3. **Admin product paging / scale** (§7 admin half) — required before large catalog UX  
4. **Shop filters, price slider, tags** (§3 + §7 storefront half)  
5. **Lazy search + Asc/Desc** (§6)  
6. **Footer contact & social** (§4)  
7. **Journal media uploads** (§5)

---

## Out of scope for this document

- Implementation PRs, migrations, or UI wiring  
- Redesign of unrelated admin list pages (orders, customers) unless they share the same pagination primitives  
- Changing payment, shipping, or checkout flows  

When a task is started, flip its **Status** from `TODO` to `IN PROGRESS` / `DONE` in this file.
