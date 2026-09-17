# Brand Philosophy — Selfieface

## Brand essence

Selfieface should feel like entering a modern digital beauty boutique: warm, precise, editorial, and calm. Luxury without coldness. Education without overwhelm.

## Voice

| Do | Don't |
| --- | --- |
| Warm, precise, editorial | Hype words (“miracle”, “instant transformation”) |
| Ingredient clarity in plain language | Dense clinical jargon dumps |
| Guide with confidence | Shame or fear-based copy |
| Short, intentional sentences | Cluttered promo stacks |

Tone spectrum: **calm luxury** — closer to a beauty editor than a flash sale site.

## Visual direction

### Modern Editorial Luxury

The visual identity should be:

- Artistic, classy, minimal, sophisticated
- Warm, premium, contemporary, calm

Avoid generic beauty-site aesthetics and excessive:

- Pink gradients
- Glassmorphism everywhere
- Huge shadows
- Unnecessary animations
- Excessive rounded cards
- Visual clutter

### Locked design tokens

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

See also [designPattern.md](./designPattern.md) for dark mode and full brand guidance.

### Typography

| Role | Family | Use |
| --- | --- | --- |
| Display | Cormorant Garamond | Brand wordmark, hero headlines, editorial titles |
| Interface | DM Sans | Navigation, body, forms, admin UI, product metadata |

Principle:

```text
Editorial typography
        +
Modern interface typography
        =
Premium digital identity
```

### Spacing and composition

- Prefer generous whitespace and clear hierarchy over density
- One job per section on the storefront
- Hero: brand-forward, one headline, one supporting line, one CTA group, one dominant image
- Motion: intentional presence and hierarchy (2–3 deliberate motions), not decorative noise

## Shared UI, different UX

Client and Admin share the same visual language (`packages/ui`) but not the same layout patterns.

### Client (storefront)

Priorities:

```text
Discovery
Emotion
Storytelling
Shopping
```

Experience goal: beauty editorial + premium store. Homepage and product pages should educate and inspire before they sell.

### Admin (dashboard)

Priorities:

```text
Efficiency
Information
Operations
Control
```

Experience goal: elegant but productive — dense enough for ops, never chaotic.

## Brand test

If the first viewport of the storefront could belong to another brand after removing the nav, branding is too weak. The name **Selfieface** must read as a hero-level signal on branded surfaces.

## Related documents

- [PRODUCT_VISION.md](./PRODUCT_VISION.md)
- [USER_PERSONAS.md](./USER_PERSONAS.md)
