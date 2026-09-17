# ✦ Beauty E-Commerce Platform

> **A digital beauty boutique where commerce feels like discovery, information feels like guidance, and every interaction feels intentional.**

A premium, full-stack e-commerce platform dedicated to **cosmetics, skincare, body care, and wellness products**.

The platform is designed as two connected applications:

* **Client Storefront** — an elegant, editorial, immersive shopping experience.
* **Admin Dashboard** — a powerful interface for managing products, orders, customers, inventory, content, and analytics.

Both applications share a common **design system and UI component library**, while maintaining different UX patterns for customers and administrators.

### Localization & currencies

The platform is built for regional audiences and adapts automatically based on where the visitor opens the app:

**Languages**
* Arabic
* English
* French

**Currencies**
* USD (US Dollar)
* TND (Tunisian Dinar)
* AED (UAE Dirham)

Language and currency are shown according to the visitor’s region / market. Users can browse, shop, and checkout in the locale that matches their area.

---

# 1. Vision

This project should NOT feel like a generic e-commerce template.

The goal is to create a digital beauty experience combining:

* Luxury
* Editorial design
* Product discovery
* Beauty education
* Trust
* Simplicity
* High-quality interactions
* Excellent performance

The customer should feel like they are entering a **modern digital beauty boutique**, not an ordinary online marketplace.

### Core philosophy

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

Every feature and design decision should support this journey.

---

# 2. Main Applications

## Client

The customer-facing application.

Responsibilities:

* Browse products (visible to guests without login)
* Search products
* Filter products
* Explore categories
* View product details
* Share products to social media via shareable product links
* Discover related products on the product page
* Discover ingredients
* Build routines
* Add products to cart
* Manage wishlist
* Checkout (including guest checkout with phone, address, and delivery cost)
* Track orders
* Read beauty content
* Manage customer account
* Multi-language experience (Arabic, English, French)
* Region-based currency display (USD, TND, AED)

---

## Admin

The business management application.

Responsibilities:

* Dashboard
* Product management
* Category management
* Brand management
* Ingredient management
* Inventory management
* Order management
* Customer management
* Reviews
* Promotions
* Coupons
* Collections
* Editorial content
* Homepage layout and branding (colors, logo, hero and section images)
* Promotional and ad banners (create, schedule, replace without code changes)
* Analytics
* Store settings
* Admin users and permissions

---

## Server

The central backend API.

Responsibilities:

* Authentication
* Authorization
* Business logic
* Product management
* Inventory
* Cart
* Orders
* Payments
* Customers
* Reviews
* Promotions
* Content
* Analytics
* Notifications

The server is the **source of truth** for all commerce-related calculations.

---

# 3. Technology Stack

## Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS
* shadcn/ui
* Framer Motion

## Backend

* NestJS
* TypeScript
* REST API
* Prisma ORM

## Database

* PostgreSQL

## Infrastructure

* pnpm
* Turborepo
* Docker
* Environment variables

## Authentication

* JWT
* Refresh tokens
* Role-Based Access Control
* Permission-based authorization

## Storage

S3-compatible object storage for:

* Product images
* Editorial images
* User assets
* Marketing media

---

# 4. Repository Architecture

The project uses a monorepo architecture.

```text
beauty-store/
│
├── apps/
│   │
│   ├── client/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── styles/
│   │
│   ├── admin/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── hooks/
│   │   └── lib/
│   │
│   └── server/
│       └── src/
│           ├── auth/
│           ├── users/
│           ├── customers/
│           ├── products/
│           ├── categories/
│           ├── brands/
│           ├── ingredients/
│           ├── inventory/
│           ├── cart/
│           ├── orders/
│           ├── payments/
│           ├── shipping/
│           ├── reviews/
│           ├── wishlist/
│           ├── coupons/
│           ├── promotions/
│           ├── content/
│           ├── notifications/
│           ├── analytics/
│           └── common/
│
├── packages/
│   │
│   ├── ui/
│   ├── types/
│   ├── validation/
│   ├── config/
│   └── utils/
│
├── docs/
│
├── .cursor/
│   └── rules/
│
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── docker-compose.yml
└── README.md
```

---

# 5. Shared UI Architecture

Client and Admin must share the same visual language.

Shared components belong in:

```text
packages/ui/
```

Examples:

```text
Button
Input
Select
Dialog
Modal
Drawer
Tabs
Badge
Card
Table
Pagination
Toast
Dropdown
Avatar
Skeleton
Tooltip
Form
```

Domain-specific components may also be shared when appropriate:

```text
ProductCard
ProductImage
ProductPrice
ProductBadge
OrderStatus
Rating
```

However:

> Client and Admin layouts should NOT be forced into the same UX structure.

The client prioritizes:

```text
Discovery
Emotion
Storytelling
Shopping
```

The admin prioritizes:

```text
Efficiency
Information
Operations
Control
```

---

# 6. Design Philosophy

## Visual Direction

### Modern Editorial Luxury

The visual identity should be:

* Artistic
* Classy
* Minimal
* Sophisticated
* Warm
* Premium
* Contemporary
* Calm

Avoid generic beauty-site aesthetics.

Avoid excessive:

* Pink gradients
* Glassmorphism everywhere
* Huge shadows
* Unnecessary animations
* Excessive rounded cards
* Visual clutter

---

## Suggested Palette

Design tokens aligned with Selfieface ([docs/designPattern.md](./docs/designPattern.md)):

```css
--background: #F7F4EF;
--foreground: #171512;

--primary: #171512;
--secondary: #6F6A61;

--brand: #381F43;
--brand-hover: #4A2B56;
--accent: #381F43;
--accent-soft: #E8DED2;
--accent-foreground: #F7F4EF;

--surface: #FCFAF7;
--surface-muted: #E8DED2;

--border: #D8CFC5;
--success: #71816B;
--error: #9A5F62;
```

Dark mode uses plum `#B08ABB` on warm espresso surfaces — see the design pattern doc.

---

# 7. Typography

Use a combination of elegant display typography and modern UI typography.

### Display

Possible choices:

```text
Cormorant Garamond
Playfair Display
DM Serif Display
```

### Interface

Possible choices:

```text
Inter
Manrope
DM Sans
```

General principle:

```text
Editorial typography
        +
Modern interface typography
        =
Premium digital identity
```

---

# 8. Client Experience

The client should feel like a beauty editorial experience combined with a premium store.

## Homepage

Potential structure:

```text
Navigation

Hero
│
├── Editorial imagery
├── Brand statement
└── Primary CTA

Top products

New products

Incoming products

Shop by Concern

Featured Collection

Bestsellers

Beauty Ritual

Editorial / Journal

Ingredient Education

Customer Reviews

Newsletter

Footer
```

Homepage content is **admin-managed**, not hard-coded:

* **Branding** — store colors, logo, and key imagery can be updated from the dashboard.
* **Sections** — hero, featured blocks, and supporting images can be swapped or reordered over time.
* **Product rails** — top products, new products, and incoming products appear on the home page.
* **Ad banners** — promotional banners (campaigns, sales, new arrivals) are changeable; placement and creative can be updated when marketing needs change.

The storefront reflects whatever is published for the active region/locale.

---

# 9. Client Routes

```text
/
├── shop
├── products
│   └── [slug]
│
├── categories
│   └── [slug]
│
├── brands
│   └── [slug]
│
├── search
│
├── cart
├── checkout
│
├── wishlist
│
├── account
│   ├── profile
│   ├── orders
│   ├── orders/[id]
│   └── wishlist
│
├── journal
│   └── [slug]
│
├── routines
│   └── [slug]
│
├── ingredients
│   └── [slug]
│
└── about
```

---

# 10. Product Experience

Product pages are one of the most important parts of the application.

A product page should answer:

* What is it?
* Why should I use it?
* Who is it for?
* What does it contain?
* How do I use it?
* What products work with it?
* What size/options are available?
* Is it in stock?

Example structure:

```text
Product Gallery

Product Name

Rating

Price

Short Description

Variant Selection

Add to Bag

────────────────

Why You'll Love It

────────────────

Benefits

────────────────

Key Ingredients

────────────────

How To Use

────────────────

Suitable For

────────────────

Ingredients

────────────────

Reviews

────────────────

Complete Your Ritual (related products)

────────────────

Share this product (social / copy link)
```

---

# 11. Product Model Philosophy

A product and its purchasable variants are separate concepts.

Example:

```text
Hydrating Body Lotion
│
├── 250ml
├── 500ml
└── 1L
```

Each variant may have:

```text
SKU
Price
Compare-at price
Stock
Weight
Barcode
```

Never assume that one product equals one inventory item.

---

# 12. Admin Dashboard

The admin should be elegant but optimized for productivity.

Main navigation:

```text
Dashboard

Catalog
├── Products
├── Categories
├── Brands
├── Ingredients
├── Collections
└── Inventory

Orders
├── All Orders
├── Pending
├── Processing
├── Shipped
├── Delivered
└── Cancelled

Customers
├── Customers
├── Segments
└── Reviews

Content
├── Homepage
├── Journal
├── Routines
├── Collections
└── Media

Marketing
├── Coupons
├── Discounts
├── Promotions
└── Campaigns

Analytics
├── Revenue
├── Orders
├── Products
└── Customers

Settings
├── Store
├── Users
├── Roles
├── Payments
├── Shipping
└── Notifications
```

---

# 13. Backend Modules

NestJS should use domain-oriented modules.

```text
server/src/

auth/
users/
customers/

products/
categories/
brands/
ingredients/
collections/

inventory/

cart/
orders/
payments/
shipping/

wishlist/
reviews/

coupons/
promotions/

content/
notifications/

analytics/

common/
```

Each module should own its:

```text
Controller
Service
DTOs
Entities / Prisma access
Validation
Tests
```

Avoid creating a giant global service containing unrelated business logic.

---

# 14. Database Core Entities

Main entities:

```text
User
Role
Permission

Customer

Product
ProductVariant
ProductImage

Category
Brand
Ingredient
Collection

Inventory
InventoryMovement

Cart
CartItem

Order
OrderItem

Payment
Shipment

Wishlist
WishlistItem

Review

Coupon
Promotion

Article
Routine

Media
```

---

# 15. Authentication & Authorization

User types:

```text
CUSTOMER
ADMIN
```

Possible admin roles:

```text
SUPER_ADMIN
ADMIN
MANAGER
EDITOR
```

Permissions should be granular.

Examples:

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

Never rely exclusively on frontend checks.

Authorization must be enforced by the NestJS backend.

---

# 16. API Philosophy

The initial API uses REST.

Example:

```text
GET    /api/products
GET    /api/products/:slug
POST   /api/products

PATCH  /api/products/:id
DELETE /api/products/:id
```

Authentication:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
```

Cart:

```text
GET    /api/cart
POST   /api/cart/items
PATCH  /api/cart/items/:id
DELETE /api/cart/items/:id
```

Orders:

```text
POST  /api/orders
GET   /api/orders
GET   /api/orders/:id
PATCH /api/orders/:id/status
```

Admin:

```text
GET /api/admin/dashboard
GET /api/admin/analytics
```

---

# 17. Commerce Security Rules

The server is authoritative.

Never trust:

```text
Price
Discount
Tax
Shipping cost
Stock
Order total
```

received from the client.

The backend must calculate:

```text
subtotal
+
discount
+
shipping
+
tax
=
total
```

Stock must also be validated server-side.

Monetary values should be represented using integer minor units when possible.

Example:

```text
€42.50

stored as

4250
```

---

# 18. Development Philosophy

Development must happen incrementally.

Never attempt to build the entire platform in one step.

Use:

```text
Phase
 ↓
Feature
 ↓
Specification
 ↓
Database
 ↓
API
 ↓
UI
 ↓
Tests
 ↓
Polish
```

Each phase must produce a working application.

---

# 19. Development Phases

## Phase 0 — Product Definition

Define:

* Brand
* Target audience
* Products
* Categories
* Business model
* Shipping
* Payment
* Returns
* Visual identity
* Business rules
* Supported languages (Arabic, English, French)
* Supported currencies by region (USD, TND, AED)

Documentation:

```text
PRODUCT_VISION.md
BRAND_PHILOSOPHY.md
USER_PERSONAS.md
BUSINESS_RULES.md
FEATURES.md
```

---

## Phase 1 — Foundation

Set up:

* Monorepo
* Next.js client
* Next.js admin
* NestJS server
* PostgreSQL
* Prisma
* Shared UI
* TypeScript
* ESLint
* Prettier
* Docker
* Environment configuration

Goal:

> All applications run correctly locally.

---

## Phase 2 — Design System

Build:

* Colors
* Typography
* Spacing
* Buttons
* Inputs
* Cards
* Navigation
* Tables
* Dialogs
* Toasts
* Loading states
* Empty states
* Error states

Goal:

> Establish the visual identity before building the entire UI.

---

## Phase 3 — Authentication

Implement:

* Registration
* Login
* Logout
* Refresh tokens
* Password hashing
* Password reset
* Customer accounts
* Admin accounts
* Roles
* Permissions

---

## Phase 4 — Catalog

Implement:

* Products
* Product variants
* Categories
* Brands
* Ingredients
* Collections
* Product images
* Inventory

Client:

```text
Product listing
Search
Filters
Product page
```

Admin:

```text
Product CRUD
Category CRUD
Inventory
Media management
```

---

## Phase 5 — Commerce

Implement:

* Cart
* Cart items
* Wishlist
* Checkout
* Addresses
* Shipping
* Coupons
* Order creation

Customer flow:

```text
Product
 ↓
Add to Bag
 ↓
Cart
 ↓
Checkout
 ↓
Address
 ↓
Shipping
 ↓
Payment
 ↓
Order Confirmation
```

---

## Phase 6 — Orders

Admin:

* Order list
* Order details
* Order timeline
* Payment status
* Shipping status
* Customer information
* Order items
* Refund/cancellation architecture

---

## Phase 7 — Editorial Content

Implement:

* Journal
* Beauty guides
* Routines
* Ingredient education
* Collections
* Campaigns
* Homepage editor (colors, logo, images, section content)
* Ad / promo banner management (create, update, enable/disable)

Content should connect naturally to products.

Example:

```text
Article
   ↓
Ingredient
   ↓
Products
   ↓
Routine
   ↓
Add to Bag
```

---

## Phase 8 — Reviews & Customer

Implement:

* Product reviews and ratings
* Review moderation
* Customer profile
* Customer list in admin
* Analytics basics

---

## Phase 10 — Guest commerce, sharing, related products & seed

Implement:

* Guests can browse the full catalog without login
* Guest session for cart without auth
* Guest checkout in small easy steps: name & phone → address → delivery cost / cash on delivery
* Related products on the product page
* Shareable product links for social media (share + copy link)
* Seed data with complete catalog images (temporary Unsplash URLs OK for local/dev)

Guest checkout flow (no account):

```text
Browse catalog
 ↓
Add to Bag
 ↓
Cart
 ↓
Checkout
 ↓
Name & phone number
 ↓
Delivery address
 ↓
Delivery cost / Cash on delivery
 ↓
Order Confirmation
```

---

## Phase 11 — Homepage merchandising, deferred behavior & SEO

Implement:

* Homepage sections: **Top products**, **New products**, **Incoming products**
* Follow user behavior for search queries and product clicks
* Collect events on the frontend; do **not** update the server on every action
* Flush the batch when the user leaves (tab hide / page unload / beacon)
* Server applies popularity and search insights asynchronously after the batch arrives
* SEO features: meta tags, Open Graph, canonical URLs
* SEO search / discoverability links: sitemap, robots, structured data, crawlable product and category URLs

Behavior update rule:

```text
User browses (search, clicks)
 ↓
Collect events in the frontend (batch)
 ↓
Do NOT hit the server on every action
 ↓
On leave / tab hide / session end → send batch to server
 ↓
Server updates rankings / insights asynchronously
```

---

## Phase 12 — Optimization, caching, errors, advanced SEO & pre-production

Pre-production hardening before go-live. Do this after core commerce is stable.

Implement:

* Performance optimization (bundles, images, lazy loading, slow query review)
* Caching for catalog / homepage / API responses (cache headers; Redis or in-memory where useful)
* Sensible client cache for product list, detail, and homepage rails; invalidate on admin updates
* Centralized server error handler (consistent API errors, logging, no stack leaks in production)
* Client error boundaries and friendly error / empty states
* Advanced SEO: hreflang (ar / en / fr), JSON-LD Product / BreadcrumbList, image alt text, SSR/ISR for key pages
* Pre-production setup: env secrets, HTTPS, CORS, rate limits, Stripe live-keys checklist
* Pre-production: backups, health checks, monitoring / alerts, staging smoke tests
* Pre-production: CDN for images/assets, production Docker / deploy config

Suggested order before production:

```text
Optimize hot paths + images
 ↓
Add caching (API + pages + assets)
 ↓
Harden error handling + logging
 ↓
Advanced SEO pass
 ↓
Staging smoke tests
 ↓
Secrets / HTTPS / payments checklist
 ↓
Go live
```
