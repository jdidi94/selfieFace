# Business Rules — Selfieface

Operational rules that become backend constraints. The NestJS server is the source of truth for all commerce calculations.

---

## Catalog

### Product vs variant

A **product** is the sellable concept (name, story, ingredients, images, category). A **product variant** is the purchasable SKU.

Example:

```text
Hydrating Body Lotion
├── 250ml
├── 500ml
└── 1L
```

Each variant owns:

| Field | Notes |
| --- | --- |
| SKU | Unique |
| Price | Integer cents (EUR) |
| Compare-at price | Optional; integer cents |
| Stock | On-hand quantity |
| Weight | For shipping calculation |
| Barcode | Optional |

Never assume one product equals one inventory item.

### Product status

- Only **active** products with at least one purchasable (in-stock or allowed backorder — MVP: in-stock only) variant appear in the storefront catalog.
- Draft / archived products are admin-only.

### Categories, brands, ingredients, collections

- A product belongs to one primary **category** and may appear in multiple **collections**.
- A product has one **brand** (Selfieface or partner).
- Products may link many **ingredients**; ingredients are first-class entities for education pages.

---

## Money

- Currency: **EUR**
- Store monetary values as **integer minor units** (cents). Example: €42.50 → `4250`
- Never trust client-sent: price, discount, tax, shipping cost, stock, or order total
- Server computes:

```text
subtotal
+ discount
+ shipping
+ tax
= total
```

- Tax and shipping rates are configured server-side (store settings). MVP may use a simple VAT rate and flat/zone shipping tables.

---

## Cart and checkout

### Eligibility

A line item may be added or updated only if:

1. Product is active
2. Variant exists and is active
3. Requested quantity ≤ available stock (MVP: no backorders)
4. Quantity ≥ 1

### Cart ownership

- Authenticated customers: cart tied to customer account
- Guests: cart tied to session (`guestToken`); merge on login
- Guest checkout creates a guest `Customer` (phone, `isGuest`) without a user account; order access uses `guestAccessToken` in the browser for payment/confirmation

### Coupons (MVP)

- **One coupon per order**
- Coupon validated server-side (code, validity window, min subtotal, usage limits)
- No stacking of multiple coupons
- Loyalty points **may stack** with a single coupon (no exclusivity)
- Discount applied to eligible line items only as defined by coupon rules
- Optional customer-facing `description` for the storefront active-offers bar

---

## Inventory

- Stock is decremented when an order is **confirmed** (payment authorized/captured per payment flow), not merely when an item is added to cart
- Cart reservation is soft for MVP (validate stock again at checkout)
- All stock changes create an **inventory movement** record (reason: sale, restock, adjustment, return, transfer)
- Sellable quantity is the **sum across active warehouses**; checkout allocates from the **default warehouse first**, then others (may split a line)
- Cancel/refund restocks to the warehouses recorded on `OrderItemAllocation` when present

---

## Orders

### Status lifecycle

```text
Pending → Processing → Shipped → Delivered
                ↘
              Cancelled
```

| Status | Meaning |
| --- | --- |
| Pending | Order created; awaiting payment confirmation or admin acceptance |
| Processing | Paid / accepted; being prepared |
| Shipped | Handed to carrier; tracking may be attached |
| Delivered | Confirmed delivered or delivery window complete |
| Cancelled | Cancelled before ship; stock restocked when applicable |

### Rules

- Customers can cancel only while status is **Pending** (and payment allows)
- Admins may cancel until **Shipped**, subject to refund policy
- Status transitions are validated server-side; invalid jumps are rejected
- Order line prices are **snapshots** at purchase time (historical accuracy)

---

## Payments

- MVP: **Stripe** card payments (test mode in development)
- Payment status tracked separately from fulfillment status (e.g. unpaid, authorized, captured, refunded, failed)
- Cash on delivery is **out of scope** for MVP card checkout; **guest checkout** may use cash on delivery (Phase 10) with payment status `AUTHORIZED` until collected

---

## Shipping

- Domestic: flat rate
- EU: zone-based rates
- Free shipping when order subtotal (after discount) ≥ configured threshold
- Shipping amount always calculated on the server from address + cart weight/subtotal rules

---

## Returns and refunds

- **Window:** 30 days from delivery
- **Condition:** unopened / unused; hygiene seal intact for cosmetics where applicable
- Refunds return stock via inventory movement when items are restockable
- Architecture in Phase 6 may model return requests; full returns portal can follow after core order ops

---

## Authentication and authorization

### User types

```text
CUSTOMER
ADMIN
```

### Admin roles

```text
SUPER_ADMIN
ADMIN
MANAGER
EDITOR
```

### Permission examples

```text
products.read
products.create
products.update
products.delete

orders.read
orders.update

customers.read

inventory.read
inventory.update

content.read
content.create
content.update

analytics.read
```

Rules:

- Authorization is enforced on the **NestJS** backend, never only in the UI
- CUSTOMER tokens cannot access `/api/admin/*` routes
- EDITOR focuses on content; MANAGER on catalog/orders/inventory; SUPER_ADMIN has full access

---

## Related documents

- [PRODUCT_VISION.md](./PRODUCT_VISION.md)
- [FEATURES.md](./FEATURES.md)
- [USER_PERSONAS.md](./USER_PERSONAS.md)
