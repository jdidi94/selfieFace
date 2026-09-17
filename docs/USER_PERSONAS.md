# User Personas — Selfieface

Three primary personas drive product and UX decisions. Secondary personas may be added later; these three are enough for Phases 1–6.

---

## Maya — Ingredient-curious shopper

| | |
| --- | --- |
| **Age** | 28 |
| **Role** | Customer |
| **Context** | Lives in a mid-size EU city; researches before buying; values skin health over trends |

### Goals

- Understand what a product does and why it suits her
- Learn key ingredients and how to use them in a ritual
- Buy with confidence, not impulse regret

### Pain points

- Opaque ingredient lists and marketing fluff
- Product pages that only show price and swatches
- Feeling lost between “too many options”

### Primary flows

1. Land on homepage → Shop by concern / featured collection
2. Open product detail → benefits, key ingredients, how to use, suitable for
3. Explore related ingredient or routine → add complementary products
4. Add to bag → checkout

### Design implications

- Rich PDP structure (gallery, education sections, complete-your-ritual)
- Ingredient and journal content linked to products
- Clear “suitable for” and usage guidance

---

## Sara — Efficient repeater

| | |
| --- | --- |
| **Age** | 36 |
| **Role** | Customer |
| **Context** | Busy professional; already knows her staples; reorders and occasionally tries one new item |

### Goals

- Find a known product fast
- Save favorites and reorder without friction
- Complete checkout in as few steps as possible

### Pain points

- Slow search and weak filters
- Forced to re-enter addresses and payment details
- Losing track of past orders

### Primary flows

1. Search or brand/category browse → add variant to bag
2. Wishlist save for later → move to cart
3. Checkout with saved address → pay → confirmation
4. Account → orders → reorder

### Design implications

- Strong search, filters, and category/brand routes
- Wishlist and account order history
- Streamlined cart and checkout; saved addresses

---

## Leila — Catalog and operations manager

| | |
| --- | --- |
| **Age** | 34 |
| **Role** | Admin (MANAGER) |
| **Context** | Runs day-to-day catalog and fulfillment for Selfieface; not a developer |

### Goals

- Keep products, variants, prices, and stock accurate
- Process orders and update shipping status quickly
- Spot issues (low stock, failed payments) without hunting

### Pain points

- Clunky CRUD and missing bulk clarity
- Inventory that doesn’t match what customers see
- Orders without a clear timeline or customer context

### Primary flows

1. Catalog → create/edit product + variants + images
2. Inventory → adjust stock / review movements
3. Orders → list → detail → update status (Processing → Shipped)
4. Dashboard glance at revenue, pending orders, low stock

### Design implications

- Efficient admin tables, filters, and forms
- Product/variant/inventory as first-class concepts
- Order detail with timeline, payment, shipping, and line items
- Permission-aware UI (server still enforces authorization)

---

## Persona → journey mapping

| Journey stage | Maya | Sara | Leila |
| --- | --- | --- | --- |
| Trust | Reviews, ingredients | Brand familiarity | Accurate catalog |
| Discovery | Concerns, editorial | Search, bestsellers | Collections setup |
| Education | PDP, journal, routines | Quick specs | Content tools (later) |
| Confidence | Suitable for, rituals | Ratings, past buys | Stock truth |
| Purchase | Guided add-to-bag | Fast checkout | Order ops |
| Relationship | Journal, routines | Wishlist, reorder | Customer view |

## Related documents

- [PRODUCT_VISION.md](./PRODUCT_VISION.md)
- [FEATURES.md](./FEATURES.md)
- [BUSINESS_RULES.md](./BUSINESS_RULES.md)
