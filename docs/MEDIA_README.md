# Selfieface — Media assets report

Preparation guide for brand and catalog imagery. Use this when you produce or commission assets.

**Website name:** Selfieface  
**Domain (planned):** selfieface.shop  
**Brand palette (primary):** plum `#381F43` · cream `#F7F4EF` · dark accent `#B08ABB`

Related: [designPattern.md](./designPattern.md) (identity) · [SETUP.md](./SETUP.md) (upload / CDN)

---

## 1. What the platform accepts

| Kind | MIME / format | Notes |
| --- | --- | --- |
| Raster photos | JPEG, PNG, WebP, TIFF, AVIF, BMP | Auto-resized & converted to **WebP** on upload |
| GIF | `image/gif` | Stored as-is (no compress) |
| Vector | SVG | Stored as-is (logos / marks preferred) |
| Video | MP4, WebM | Stored as-is (journal / editorial) |

**Server processing (raster):**

- Max longest edge: **1920 px**
- Output: **WebP ~quality 80**
- Width / height stored when known
- Public URL form: `/api/media/:id` (optional CDN via `NEXT_PUBLIC_MEDIA_URL`)

**Prep tip:** Export masters a bit larger than display size; the server will downscale. Prefer sRGB. Avoid text-heavy PNGs larger than needed.

---

## 2. Size report by placement

### Brand & chrome

| Asset | Type | Target size | Aspect | Notes |
| --- | --- | --- | --- | --- |
| Wordmark (header) | SVG + PNG | Transparent; display ~**40–48 px** tall | Auto | Light UI on cream |
| Wordmark inverted | SVG + PNG | Same | Auto | Cream / plum on transparent for dark UI |
| Emblem / mark only | SVG | Scalable | ~1:1 | Profiles + botanical; **no full wordmark** at tiny sizes |
| Favicon | ICO + PNG/SVG | **16×16**, **32×32** | 1:1 | Emblem only |
| Apple touch | PNG | **180×180** | 1:1 | Emblem on cream `#F7F4EF` |
| PWA icon | PNG | **192×192**, **512×512** | 1:1 | Emblem; must read at 16 px |
| Social avatar | PNG | **400×400** | 1:1 | Emblem or short mark |
| Open Graph / share | PNG or JPG | **1200×630** | ~1.91:1 | Brand + skincare / hair care mood |
| Email logo | PNG | ~**600 px** wide | Auto | Transparent or cream bg |

### Storefront catalog

| Placement | Type | Recommended export | Aspect | UI crop |
| --- | --- | --- | --- | --- |
| Product / pack primary | JPEG / PNG / WebP | **1600×2000** (or 1200×1500 min) | **4:5** | Cards & PDP use `aspect-[4/5]` |
| Product gallery extras | Same | Same 4:5 | 4:5 | Thumbnails + main gallery |
| Category tile | JPEG / WebP | **1200×1500** | 4:5 | Carousel / shop filters |
| Brand image | JPEG / WebP / SVG | **800×800** or 4:5 photo | 1:1 or 4:5 | Admin brand image |
| Cart / bag / wishlist thumb | (from product) | — | — | Display ~80–96 px; use product master |

### Homepage & promo

| Placement | Type | Recommended export | Aspect | UI crop |
| --- | --- | --- | --- | --- |
| Home hero banner (`HOME_HERO`) | JPEG / WebP | **1920×1080** | **16:9** | Full-bleed / `aspect-[16/9]` |
| Home secondary banner | JPEG / WebP | **1600×900** | 16:9 | Same family |
| Merchandising rail product images | — | Use product 4:5 masters | 4:5 | Product cards |

### Journal / editorial

| Placement | Type | Recommended export | Aspect | Notes |
| --- | --- | --- | --- | --- |
| Article cover | JPEG / WebP | **1600×900** | **16:9** | List + detail cover |
| Inline photo | JPEG / WebP | Up to **1920** long edge | 4:5 or free | Gallery may use 4:5 |
| Inline video | MP4 (H.264) / WebM | 1280×720 or 1920×1080 | 16:9 | Keep under ~25–40 MB if possible |

---

## 3. Naming convention (suggested)

```text
selfieface-{slot}-{variant}-{WxH}.{ext}

Examples:
  selfieface-wordmark-light.svg
  selfieface-wordmark-dark.svg
  selfieface-emblem.svg
  selfieface-favicon-32.png
  selfieface-og-1200x630.jpg
  selfieface-pwa-512.png
  selfieface-product-{sku}-01-1600x2000.jpg
  selfieface-hero-home-1920x1080.webp
```

Use lowercase, hyphens, no spaces.

---

## 4. Content rules (quick)

- Inclusive beauty: face + hair care; men and women welcome in lifestyle shots.
- Prefer real product / atmosphere over abstract gradients as the main idea.
- No 3D glossy logos; keep the mark flat and editorial.
- Safe margins on OG and hero: keep logo and faces away from outer ~5–8%.
- Alt text later: describe product / scene (SEO), not only “image1”.

---

## 5. Prep checklist (fill when ready)

| # | Asset | Ready | File path / link | Notes |
| --- | ---: | :---: | --- | --- |
| 1 | Wordmark light (SVG + PNG) | ✅ | `assets/email_logo.png` → `/brand/lockup-light.png` | Header/footer/email |
| 2 | Wordmark dark (SVG + PNG) | ✅ | `assets/wordmark_inverted.png` → `/brand/lockup-dark.png` | Dark lockup |
| 3 | Emblem SVG | ✅ | `assets/emblem.svg` + `wordmark.png` → `/brand/mark.png` | Nav mark |
| 4 | Favicon 32 + Apple 180 | ✅ | `Favicon.png`, `apple_touch.png` | App icons + `/brand/*` |
| 5 | PWA 192 + 512 | ✅ | `PWA_con.png` | `/brand/pwa-*.png` + webmanifest |
| 6 | OG 1200×630 | ✅ | `open_graph.png` | Metadata + `opengraph-image.png` |
| 7 | Email logo ~600w | ✅ | `email_logo.png` | Mail layout |
| 8 | Social avatar 400×400 | ☐ | | Optional |
| 9 | Hero banner 1920×1080 | ☐ | | Catalog / CMS |
| 10 | Sample product set (4:5) | ☐ | | |
| 11 | Journal cover sample 16:9 | ☐ | | |

---

## 6. Upload path (when assets exist)

**Brand & chrome** are served from `apps/client/public/brand/` (admin mirror under `apps/admin/public/brand/`). Masters stay in `apps/client/assets/`.

1. Catalog imagery: Admin → media upload (or product / banner / journal forms).
2. Raster images compress automatically (max edge 1920 → WebP).
3. Optional: put CDN in front of `/api/media/*` and set `NEXT_PUBLIC_MEDIA_URL`.

---

*Status: brand & chrome wired into storefront, admin, and email.*
