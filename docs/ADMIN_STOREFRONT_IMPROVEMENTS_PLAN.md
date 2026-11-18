# Admin & Storefront Improvements Plan

This document tracks the requested storefront and admin improvements as separate, reviewable tasks. It records the agreed behavior and acceptance criteria before implementation.

**Status:** Implemented — storefront, admin, and server changes are in place.

## Goals

- Keep storefront filters useful by hiding inactive or unassigned taxonomy values.
- Integrate the supplied Framer Scrim carousel after checking its compatibility with the app.
- Make product images load efficiently and appear sharp at their rendered size.
- Give admins contextual, configurable help inside admin forms.
- Help admins run the store through relevant suggestions, reminders, and timely notifications.
- Identify additional admin productivity improvements for a later prioritization pass.

## Task 1 — Hide empty category and subcategory filters

**Status:** DONE
**Priority:** P1

### Scope

- Show a category or subcategory filter option only when that taxonomy record is active and is related to at least one active, storefront-visible product.
- Apply the same eligibility rule to brand filter options when they are shown in the same filter panel.
- Calculate eligibility from current product relationships so removing, deactivating, or unpublishing the last related product removes the option from the storefront.
- Do not require the related product to be in stock; an active, published out-of-stock product still counts as a related product.
- Preserve the existing localized labels, URLs, and selected-filter behavior.

### Acceptance criteria

- Inactive taxonomy values never appear in storefront filters.
- Active values with no active, storefront-visible products never appear.
- A value appears as soon as an eligible product is related to it and disappears when the last eligible relationship is removed.
- Directly requesting a filter URL with an inactive or empty value returns a sensible empty/browse state without an API error.
- Admin taxonomy management continues to show inactive and unused values so admins can manage them.
- Added an active toggle for categories and subcategories; public category, brand, and taxonomy APIs only return active values linked to active storefront products.
- Product listing also rejects inactive category, brand, and taxonomy filters when directly requested.

## Task 2 — Replace the storefront carousel with Framer Scrim

**Status:** DONE
**Priority:** P2

### Scope

- Review the supplied [Framer Scrim module](https://framer.com/m/Scrim-GXhh28.js@cR8usMuu4IMBqxbSn0XS) and determine whether it can run in the current Next.js/React app.
- Integrate the component into the existing carousel use cases, adapting its inputs and styling to the site's data and design system.
- Preserve responsive behavior, touch and keyboard controls, reduced-motion preferences, and right-to-left layout where applicable.
- Keep a graceful loading/error state if the component depends on a remote module.

### Acceptance criteria

- Existing carousel content and navigation still work with the replacement.
- The carousel works at mobile and desktop widths, with keyboard and touch navigation.
- The integration does not cause hydration errors or block page rendering if the remote module is unavailable.
- Any licensing, runtime, or security constraint found during review is recorded before choosing the integration approach.
- The hosted module imports Framer's editor-only `framer` runtime and is not directly compatible with this Next.js app. The home hero now uses a local Framer Motion implementation of the Scrim layout and behavior, avoiding a runtime dependency on Framer hosting.

## Task 3 — Optimize product image loading and sharpness

**Status:** DONE
**Priority:** P1

### Scope

- Audit product-card image usage across storefront surfaces, including home rails, shop/category/search listings, recommendations, and related-product cards.
- Request a responsive image source appropriate to the card's rendered dimensions and the device pixel ratio, so the displayed image is sharp without downloading an unnecessarily large original.
- Lazy-load images below the initial viewport and prioritize the main above-the-fold/LCP product imagery.
- Provide intrinsic dimensions or aspect ratios to prevent layout shifts while images load.
- Avoid stretching a small thumbnail to a larger display size; use the best available source/variant for the target display size.
- Reuse the existing media/CDN pipeline where possible and keep image URLs compatible with current media storage.

### Acceptance criteria

- Product cards throughout the storefront use consistent responsive loading behavior.
- Below-the-fold images are deferred until needed; initial viewport imagery is not accidentally lazy-loaded.
- At common card sizes and high-density displays, images use a sufficiently large source to look sharp at their rendered pixel dimensions.
- Images preserve their intended aspect ratio and do not create visible layout jumps while loading.
- Failed image requests have a stable fallback and do not break the card layout.
- Product cards use `next/image` responsive source selection with corrected card sizes and quality 85; below-the-fold cards remain lazy, while the hero prioritizes its active background image.

## Task 4 — Admin-managed contextual help notes

**Status:** DONE
**Priority:** P2

### Scope

- Add an info button beside selected admin inputs or sections; activating it reveals a concise explanation in context.
- Provide admin controls to enable or disable the help-note feature globally and per note.
- Let authorized admins create, edit, review/moderate, and retire help notes, and choose which form field or section each note belongs to.
- Support the admin app's existing locales and use an accessible interaction that works by keyboard and screen reader.
- Use a structured field/section identifier instead of relying on fragile display text to attach a note.

### Acceptance criteria

- Admins can manage note content, status, and placement without a code change.
- Disabled notes and globally disabled help do not appear in forms.
- The info control is available only where a note is enabled and assigned.
- Missing or untranslated note content falls back safely and does not block form use.
- Notes do not expose unsafe HTML or untrusted executable content.
- Added an authenticated, permission-checked notes manager with global/per-note enable controls, field placement, and EN/AR/FR text. Product, category, inventory, coupon, and settings fields show the configured info button.

## Task 5 — Store planning assistant, reminders, and notifications

**Status:** DONE
**Priority:** P3 — largest task; split into implementation milestones after discovery

### Scope

- Identify useful store signals already available, such as sales/order trends, low stock, products without images or descriptions, inactive catalog items, and promotion performance.
- Create a persistent admin notification center for actionable reminders, promotion opportunities, and concise interpretations of store activity.
- Support real-time delivery to open admin sessions through the project's socket infrastructure, with a persistent/in-app fallback when disconnected.
- Support configurable email reminders through the existing email service, with frequency controls and duplicate suppression.
- Generate recommendations from transparent rules and store metrics first. Treat Grok as an optional, replaceable API provider for summarization or strategy suggestions; keep secrets server-side and make core reminders work if the provider is unavailable.
- Let admins review, dismiss, snooze, or act on notifications and control which categories of reminders they receive.
- Record the triggering data or reason behind each recommendation so an admin can understand why it was shown.

### Acceptance criteria

- A reminder is tied to a clear store event or metric and includes a useful next action.
- Notifications are persisted, deduplicated, and visible after a page reload.
- Connected admins receive new notifications in real time; disconnected admins can see them later.
- Email reminders respect admin settings and do not repeatedly send the same unresolved reminder.
- Recommendations remain available without an AI provider; AI output is advisory, bounded to store data, and never silently changes products, prices, or campaigns.
- Admins can trace a recommendation to its source data and manage its notification state.
- Added daily rule-based low-stock, catalog-completeness, and declining-order insights; an authenticated Socket.IO feed; an admin notification center with snooze/dismiss; optional SES digest settings; and an optional server-side Grok analysis endpoint that falls back to rule-based summaries.

### Suggested milestones

1. Inventory available signals, socket support, email infrastructure, and admin roles/settings.
2. Define notification types, persistence, deduplication, and admin preferences.
3. Ship rule-based in-app notifications and a notification center.
4. Add real-time delivery and email reminder scheduling.
5. Add promotion suggestions and activity summaries; evaluate optional Grok integration behind a provider interface.

## Additional admin productivity ideas

These follow-up ideas now have acceptance criteria and implementation tracking in [Admin Productivity Tasks](./ADMIN_PRODUCTIVITY_TASKS.md):

- **Catalog completeness queue:** one view for products missing images, translations, prices, stock, or required attributes, with direct edit actions.
- **Saved admin filters:** save and share common product, order, and inventory views.
- **Bulk edit preview:** preview changes to selected products before applying them, with a clear result summary.
- **Daily operations dashboard:** surface orders needing action, low stock, failed emails, and unresolved customer issues in one place.
- **Change history:** show who changed a price, stock level, promotion, or product status and when.

## Suggested implementation order

1. Task 1 — filter eligibility (small, clear storefront behavior change).
2. Task 3 — responsive product image loading and sharpness.
3. Task 2 — carousel module compatibility review and integration.
4. Task 4 — contextual notes data model and admin management, then form integration.
5. Task 5 — notification discovery and data model, followed by delivery channels and recommendations.

For each task, update its status here as work begins and record implementation-specific decisions that affect the acceptance criteria.

## Deployment note

The new `20261115120000_admin_help_notifications` migration has been applied to Render. Prisma reports the database schema is up to date. The database was migrated without running the seed command.
