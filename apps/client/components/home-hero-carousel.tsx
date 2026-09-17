'use client';

import { Button } from '@lumea/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  bannerCtaPrimaryClassName,
  bannerCtaSecondaryClassName,
} from '@/lib/brand-cta';
import type { HomeHeroContent } from './home-hero';

const AUTO_MS = 6500;

export function HomeHeroCarousel({
  slides,
  secondaryCta,
}: {
  slides: HomeHeroContent[];
  /** Fallback secondary CTA shown on every slide */
  secondaryCta?: { label: string; href: string };
}) {
  const [index, setIndex] = useState(0);
  const count = slides.length;
  const slide = slides[Math.min(index, Math.max(count - 1, 0))] ?? slides[0];

  const go = useCallback(
    (next: number) => {
      if (count <= 1) return;
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (count <= 1) return;
    const id = window.setInterval(() => go(index + 1), AUTO_MS);
    return () => window.clearInterval(id);
  }, [count, go, index]);

  if (!slide) return null;

  const bgStyle = slide.imageUrl
    ? {
        backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0.55)), url(${slide.imageUrl})`,
        backgroundSize: 'cover' as const,
        backgroundPosition: 'center' as const,
      }
    : {
        background:
          'radial-gradient(ellipse 120% 80% at 50% -20%, var(--accent-soft) 0%, var(--background) 55%, var(--surface-muted) 100%)',
      };

  const textOnImage = Boolean(slide.imageUrl);

  return (
    <section
      className="relative flex min-h-[calc(100vh-4rem)] flex-col justify-center px-6 py-16"
      style={bgStyle}
      aria-roledescription="carousel"
      aria-label="Promotions"
    >
      <div className="mx-auto w-full max-w-2xl">
        {slide.eyebrow ? (
          <p
            className={`mb-4 text-sm tracking-[0.22em] uppercase ${
              textOnImage ? 'text-white/80' : 'text-muted-foreground'
            }`}
          >
            {slide.eyebrow}
          </p>
        ) : null}
        <h1
          className={`font-display mb-5 text-5xl leading-[1.05] font-medium tracking-tight md:text-7xl ${
            textOnImage ? 'text-white' : 'text-foreground'
          }`}
        >
          {slide.title}
        </h1>
        {slide.subtitle ? (
          <p
            className={`mb-10 max-w-md text-lg ${
              textOnImage ? 'text-white/85' : 'text-muted-foreground'
            }`}
          >
            {slide.subtitle}
          </p>
        ) : (
          <div className="mb-10" />
        )}
        <div className="flex flex-wrap gap-3">
          <Button size="lg" className={bannerCtaPrimaryClassName} asChild>
            <Link href={slide.ctaPrimaryHref}>{slide.ctaPrimary}</Link>
          </Button>
          {(slide.ctaSecondary || secondaryCta) && (
            <Button
              variant="secondary"
              size="lg"
              className={bannerCtaSecondaryClassName}
              asChild
            >
              <Link href={slide.ctaSecondaryHref || secondaryCta?.href || '/journal'}>
                {slide.ctaSecondary || secondaryCta?.label}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {count > 1 ? (
        <>
          <div className="absolute inset-x-0 bottom-8 flex items-center justify-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Slide ${i + 1}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={`h-2 w-2 rounded-full transition ${
                  i === index
                    ? textOnImage
                      ? 'bg-white'
                      : 'bg-foreground'
                    : textOnImage
                      ? 'bg-white/40'
                      : 'bg-foreground/25'
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => go(index - 1)}
            className={`absolute start-4 top-1/2 hidden -translate-y-1/2 rounded-full border p-2 backdrop-blur sm:inline-flex ${
              textOnImage
                ? 'border-white/30 bg-black/20 text-white'
                : 'border-border bg-background/80 text-foreground'
            }`}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => go(index + 1)}
            className={`absolute end-4 top-1/2 hidden -translate-y-1/2 rounded-full border p-2 backdrop-blur sm:inline-flex ${
              textOnImage
                ? 'border-white/30 bg-black/20 text-white'
                : 'border-border bg-background/80 text-foreground'
            }`}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      ) : null}
    </section>
  );
}
