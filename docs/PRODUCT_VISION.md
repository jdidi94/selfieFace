# Product Vision — Selfieface

## Mission

Selfieface is a digital beauty boutique where commerce feels like discovery, information feels like guidance, and every interaction feels intentional.

## Positioning

Selfieface is a **direct-to-consumer e-commerce platform** dedicated to cosmetics, skincare, body care, and wellness. It is skincare-led, with curated body care, selective color, and ritual-oriented wellness products.

| Selfieface is | Selfieface is not |
| --- | --- |
| A modern editorial beauty boutique | A generic marketplace template |
| Ingredient-literate and trust-first | Drugstore volume retail |
| Calm, premium, and guided | Clinical jargon dumps or hype marketing |
| Own brand first, curated partners later | An open multi-seller marketplace |

## Customer journey

Every feature and design decision should support this path:

```text
Trust
  ↓
Discovery
  ↓
Education
  ↓
Confidence
  ↓
Purchase
  ↓
Relationship
```

## Target audience

Women aged **22–45** who want ingredient clarity, calm luxury, and a shopping experience that teaches as it sells — not drugstore convenience, not ultra-niche clinical-only brands.

## Catalog pillars

1. **Skincare** — cleansers, treatments, moisturizers, SPF
2. **Body care** — lotions, oils, washes
3. **Makeup** — curated color (lips, complexion, eyes)
4. **Wellness** — rituals, tools, and supporting products

## Business model

- **Primary:** DTC sales of Selfieface products via the client storefront
- **Secondary (later):** curated partner brands sold under the same boutique experience
- **Currency:** EUR
- **Payments (Phase 5):** card via Stripe (test mode first); cash on delivery deferred
- **Shipping:** flat-rate domestic + zone-based EU; free shipping above a threshold
- **Returns:** 30 days for unopened / unused items; hygiene seal policy for cosmetics

## MVP success criteria

The first sellable slice is successful when:

**Customer**

- Browse, search, and filter the catalog
- View a rich product detail page (variants, ingredients, how-to-use)
- Add to bag, checkout with address and shipping, pay by card
- View order confirmation and track order status in account

**Admin**

- Manage products, variants, categories, and inventory
- Manage media for product images
- View and update orders (status, payment, shipping)

**System**

- NestJS is the source of truth for price, tax, shipping, stock, and totals
- Monetary values stored in integer minor units (cents)
- JWT auth with roles and permission checks on the server

## Out of scope (early phases)

Do not build these until the core commerce loop is stable:

- Loyalty points / rewards programs
- Live chat or in-app messaging
- Multi-seller marketplace / vendor portals
- AR try-on or shade matching AI
- Mobile native apps
- Advanced personalization engines
- Subscription / auto-replenish (defer past MVP)
- Cash on delivery

## Related documents

- [BRAND_PHILOSOPHY.md](./BRAND_PHILOSOPHY.md)
- [USER_PERSONAS.md](./USER_PERSONAS.md)
- [BUSINESS_RULES.md](./BUSINESS_RULES.md)
- [FEATURES.md](./FEATURES.md)
