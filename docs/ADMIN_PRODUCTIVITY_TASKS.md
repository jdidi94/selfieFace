# Admin Productivity Tasks

This is the implementation checklist for the next admin productivity milestone. Each item has a user-visible outcome and acceptance criteria; status is updated as implementation progresses.

## Task 1 — Catalog completeness queue

**Status:** IMPLEMENTED

One market-scoped queue for products missing images, one or more supported translations, market-currency prices, sellable stock, or product attributes. Each issue links directly to the product editor. Filters by issue type and product status must be available.

**Acceptance:** issue counts are computed from current database state; a product disappears from an issue after it is fixed; pack and regular-product stock are handled consistently; users can open the relevant product editor in one click.

## Task 2 — Saved admin filters

**Status:** IMPLEMENTED

Allow admins to save named filters for product, order, and inventory lists. Filters are private by default; admins can explicitly share them with other admins in the same market. Applying a saved view restores its supported filter values; owners can update and delete their views.

**Acceptance:** saved views persist across reloads; private views are only visible to their owner; shared views are market-scoped; users can rename, update, and delete their own views.

## Task 3 — Bulk edit preview

**Status:** IMPLEMENTED

Before bulk product changes are applied, show the selected products and each field's before/after value. Require explicit confirmation and show counts for updated and skipped products. The first supported fields are publication status, brand, category, and tags.

**Acceptance:** preview has no side effects; application revalidates products and market ownership; the result summary reflects completed updates; catalog caches are invalidated afterward.

## Task 4 — Daily operations dashboard

**Status:** IMPLEMENTED

Bring pending fulfillment orders, low-stock variants, failed outgoing emails, and unresolved customer support tickets into one market-scoped operations view with links to each work queue.

**Acceptance:** counts use current persisted records; each card links to the relevant filtered admin page; the view degrades gracefully when one source has no results.

## Task 5 — Change history

**Status:** IMPLEMENTED

Show an append-only, market-scoped record of who changed product status/prices, inventory levels, and promotion settings, with timestamp and before/after values.

**Acceptance:** history records are written only after a successful change; each event identifies the admin, entity, field, old value, and new value; the admin can filter by entity and field.

## Task 6 — Live checkout changes

**Status:** IMPLEMENTED

Checkout waits for an initial shipping quote and payment options, receives Socket.IO invalidations for admin payment/shipping setting changes, refreshes cart and quote data periodically and on focus, and rechecks cart/prices/shipping/payment immediately before submitting. The API revalidates stock and payment configuration before creating an order.

**Acceptance:** shoppers see refreshed checkout settings without reloading; cart refresh failures preserve the last confirmed bag; changed cart contents, price, or total require shopper review; the server remains the source of truth at order submission.

## Task 7 — Incoming products and persistent back-in-stock requests

**Status:** IMPLEMENTED

Treat products marked Incoming / coming soon as unavailable for purchase even if future stock has been entered. Keep the product visible, disable add-to-cart actions across storefront entry points, and offer the same back-in-stock notification flow as out-of-stock products. Preserve a submitted notification state across refresh; signed-in customers also load their active request from the server.

## Task 8 — Expiring checkout stock holds

**Status:** IMPLEMENTED

Reserve inventory atomically when an order is created, protect SKU stock updates with PostgreSQL row locks, and release the reservation when unpaid checkout expires. The default hold is 15 minutes (`CHECKOUT_STOCK_HOLD_MINUTES` can set 5–60 minutes); Konnect payment link lifespan follows the hold. Product/pack component allocations are tracked so expiration and cancellation restore the correct warehouse stock.

## Implementation notes

- Keep market boundaries enforced on all reads and writes.
- Do not seed the database as part of this milestone.
- Apply only additive schema migrations required by persisted saved views and audit history.
- Update this checklist as each item is implemented and record any intentionally deferred scope here.
- The completeness queue scans up to 1,000 most recently updated non-archived products per market; larger catalogs display a truncation notice.
- Audit entries cover product status and variant price edits, bulk product edits, inventory adjustments/transfers, and promotion setting edits. Product image, translation, taxonomy, create/delete events, and promotion create/delete events are not yet recorded.
