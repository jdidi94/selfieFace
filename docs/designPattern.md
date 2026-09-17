# Selfieface — Brand & UI Design System

## 1. Brand Identity

**Brand name:** `Selfieface`  
**Slug / domain form:** `selfieface`

**Category:** Luxury beauty & personal care

**Products:**

* Face care / skincare
* Body care
* Hair care
* Beauty & wellness products

### Brand feeling

> **Luminous · Refined · Editorial · Elegant · Trustworthy · Inclusive**

The identity should feel premium and sophisticated without looking like:

* A hair salon
* A pharmacy/drugstore
* A clinical medical brand
* A playful cosmetics brand
* A neon/tech brand

---

# 2. Logo

The logo combines **male + female profiles** to represent beauty and personal care for everyone.

### Logo concept

* Wordmark: **Selfieface**
* Two elegant human profiles facing opposite directions
* Interconnected hair / botanical forms
* Minimal circular halo
* Flat vector construction
* Strong negative space
* Luxury editorial typography
* Deep plum accent representing the brand identity

### Logo colors

| Element                  | Color     |
| ------------------------ | --------- |
| Wordmark                 | `#171512` |
| Male/Female emblem       | `#381F43` |
| Purple leaf / accent     | `#381F43` |
| Light background         | `#F7F4EF` |

### Logo rule

**Do not recolor the black wordmark purple.**

The contrast between:

```text
BLACK WORDMARK  (Selfieface)
      +
DEEP PLUM SYMBOL
```

is an important part of the identity.

### Logo lockups

| Lockup | Use |
| ------ | --- |
| Full wordmark + emblem | Site header, marketing, emails |
| Emblem only | Favicon, app icon, compact UI |
| Wordmark only | Legal / monochrome print |
| Inverted (cream/plum on dark) | Dark mode header / footer |

---

# 3. Brand Palette

## Light Mode

```text
Primary Background    #F7F4EF
Surface               #E8DED2
Elevated Surface      #FCFAF7

Brand Plum            #381F43
Brand Hover           #4A2B56

Primary Text          #171512
Secondary Text        #6F6A61

Border                #D8CFC5

Success               #71816B
Error                 #9A5F62
```

### Light mode hierarchy

```text
#F7F4EF  → Main background
#FCFAF7  → Cards / inputs
#E8DED2  → Secondary surfaces
#171512  → Main typography
#6F6A61  → Secondary typography
#381F43  → Brand actions / accents
```

---

# 4. Dark Mode

Dark mode should feel like **luxury evening beauty**, not a generic black UI.

```text
Background            #171512
Surface               #211D1A
Elevated Surface      #2B2623

Primary Brand         #B08ABB
Deep Brand            #381F43

Primary Text          #F7F4EF
Secondary Text        #C9BFB5
Muted Text            #948B82

Border                #3A332E

Success               #9BAE91
Error                 #C78386
```

### Dark mode hierarchy

```text
#171512  → Main background
#211D1A  → Cards
#2B2623  → Elevated cards / modals
#F7F4EF  → Main text
#C9BFB5  → Secondary text
#B08ABB  → Interactive brand accent
#381F43  → Deep purple elements
```

---

# 5. Typography

The typography should communicate **editorial luxury**.

## Logo

Use a high-contrast serif similar to:

* Didot
* Bodoni
* Cormorant
* Playfair Display
* DM Serif Display

The exact production font can be selected based on licensing.

## Website headings

Elegant serif:

```css
font-family: "Cormorant Garamond", serif;
```

or

```css
font-family: "Playfair Display", serif;
```

## UI / Body

Use a clean modern sans-serif:

```css
font-family: "DM Sans", sans-serif;
```

or

```css
font-family: "Manrope", sans-serif;
```

### Recommended combination

```text
HEADINGS
Cormorant Garamond

BODY / UI
DM Sans

LOGO
Custom / refined serif — “Selfieface”
```

---

# 6. Design Language

## Do

* Large whitespace
* Elegant typography
* Thin borders
* Soft cream surfaces
* Deep plum accents
* Editorial product photography
* Minimal icons
* Sophisticated product cards
* Large product imagery
* Calm animations
* Rounded but controlled geometry
* Inclusive imagery (men and women, face + hair care)

## Don't

* ❌ Neon purple
* ❌ Bright pink
* ❌ Excessive gradients
* ❌ Glassmorphism everywhere
* ❌ 3D logos
* ❌ Glitter
* ❌ Cartoon illustrations
* ❌ Excessive shadows
* ❌ Medical/clinical UI
* ❌ Salon-style graphics
* ❌ Generic beauty icons
* ❌ Recoloring the Selfieface wordmark to plum

---

# 7. Buttons

### Primary

Light mode:

```text
Background: #381F43
Text:       #F7F4EF
```

Dark mode:

```text
Background: #B08ABB
Text:       #171512
```

### Secondary

```text
Background: transparent
Border:     #381F43
Text:       #381F43
```

Dark:

```text
Background: transparent
Border:     #B08ABB
Text:       #B08ABB
```

---

# 8. Product Cards

Product cards should feel closer to an **editorial beauty magazine** than an e-commerce marketplace.

### Structure

```text
┌─────────────────────────────┐
│                             │
│       PRODUCT IMAGE         │
│                             │
│                             │
├─────────────────────────────┤
│ BRAND                       │
│ Product Name                │
│                             │
│ ★★★★★                      │
│                             │
│ € XX.XX              +      │
└─────────────────────────────┘
```

Use:

* Cream backgrounds
* Minimal borders
* Generous padding
* Elegant product photography
* Small uppercase brand labels
* Serif product names

---

# 9. Iconography

Icons should be:

```text
Minimal
Thin
Geometric
Elegant
Monochrome
```

Preferred colors:

```text
#171512
#381F43
#6F6A61
```

Avoid overly detailed cosmetic icons.

---

# 10. Imagery

Photography should communicate:

**Clean beauty + confidence + premium lifestyle**

Preferred:

* Soft natural lighting
* Warm neutral environments
* Cream/beige backgrounds
* Close-up skincare photography
* Hair texture/details
* Diverse men and women
* Minimal compositions
* Editorial fashion/beauty photography

Avoid:

* Heavy makeup
* Neon backgrounds
* Overly sexualized imagery
* Clinical laboratory aesthetics
* Cheap stock-photo appearance

---

# 11. Brand Color Usage

Recommended approximate ratio:

```text
60%  #F7F4EF
20%  #FCFAF7 / #E8DED2
10%  #171512
10%  #381F43
```

The **deep plum should remain an accent**, making it more recognizable when it appears.

---

# 12. CSS Variables

```css
:root {
  /* Background */
  --background: #F7F4EF;
  --surface: #FCFAF7;
  --surface-secondary: #E8DED2;

  /* Brand */
  --brand: #381F43;
  --brand-hover: #4A2B56;

  /* Typography */
  --text: #171512;
  --text-secondary: #6F6A61;

  /* Borders */
  --border: #D8CFC5;

  /* Status */
  --success: #71816B;
  --error: #9A5F62;
}

.dark {
  /* Background */
  --background: #171512;
  --surface: #211D1A;
  --surface-secondary: #2B2623;

  /* Brand */
  --brand: #B08ABB;
  --brand-deep: #381F43;

  /* Typography */
  --text: #F7F4EF;
  --text-secondary: #C9BFB5;
  --text-muted: #948B82;

  /* Borders */
  --border: #3A332E;

  /* Status */
  --success: #9BAE91;
  --error: #C78386;
}
```

---

# 13. Brand Signature

The core visual signature of **Selfieface** is:

```text
        ♀ + ♂
          │
     BOTANICAL FORM
          │
     ───────────
      Selfieface
```

### The identity in one sentence

> **Selfieface is a refined, inclusive beauty identity combining editorial elegance, natural forms, and a distinctive deep-plum signature — for skincare, body care, and hair care.**

---

# 14. Favicon / App Icon

For small sizes, **do not use the complete wordmark**.

Use only:

**Male + female profiles + simplified botanical/halo symbol**

Primary:

```text
#381F43
```

Background:

```text
#F7F4EF
```

Dark version:

```text
#B08ABB
+
#171512
```

The emblem should remain recognizable at **16×16, 32×32, and 512×512 px**.

---

# 15. Required Brand Assets

| Asset | Format | Notes |
| ----- | ------ | ----- |
| Wordmark (Selfieface) | SVG + PNG | Transparent; header height ~40–48px |
| Wordmark inverted | SVG + PNG | Cream / plum on transparent for dark UI |
| Emblem / mark only | SVG | Favicon, app icon, compact nav |
| Favicon set | ICO + PNG/SVG | 32×32, 180×180 apple touch |
| Open Graph image | PNG/JPG | 1200×630 — Selfieface + skincare & hair care |
| Email logo | PNG | ~600px wide (email clients) |
| Social avatar | PNG | 400×400 |
| PWA icons | PNG | 192×192 + 512×512 |
