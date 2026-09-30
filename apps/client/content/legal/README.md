# Legal HTML content

Editable static HTML for storefront legal pages.

## Layout

```
content/legal/{market}/{locale}/{slug}.html
```

- **markets:** `ae`, `tn`, `other`
- **locales:** `en`, `fr`, `ar`
- **slugs:** `privacy`, `terms`, `cookies`, `shipping`, `returns`

## Serving

Routes: `/legal/{slug}` (rewritten under `/{market}/{locale}/legal/{slug}` by middleware).

Loader (`lib/legal-content.ts`) reads the market+locale file, then falls back to `other/{locale}` then `other/en`.

## Editing

Edit the HTML fragment only (no `<html>`/`<body>` wrapper). Allowed tags: `p`, `h2`, `h3`, `ul`, `li`, `strong`, `em`, `a`, `code`. Keep market-specific wording in the matching folder when policies diverge.
