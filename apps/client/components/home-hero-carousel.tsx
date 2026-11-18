'use client';

import Image from 'next/image';
import { Button } from '@lumea/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
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
  const [paused, setPaused] = useState(false);
  const [heroImageBroken, setHeroImageBroken] = useState(false);
  const reduceMotion = useReducedMotion();
  const count = slides.length;
  const slide = slides[((index % count) + count) % count] ?? slides[0];

  const go = useCallback((next: number) => {
    if (count <= 1) return;
    setIndex(((next % count) + count) % count);
  }, [count]);

  useEffect(() => {
    if (count <= 1 || paused || reduceMotion) return;
    const id = window.setInterval(() => go(index + 1), AUTO_MS);
    return () => window.clearInterval(id);
  }, [count, go, index, paused, reduceMotion]);

  useEffect(() => setHeroImageBroken(false), [slide?.imageUrl]);

  if (!slide) return null;

  const visibleSlides = count > 1
    ? [-2, -1, 0, 1, 2].map((offset) => ({
        item: slides[((index + offset) % count + count) % count]!,
        offset,
      }))
    : [{ item: slide, offset: 0 }];

  return (
    <section
      className="relative isolate flex min-h-[min(850px,calc(100svh-4rem))] flex-col overflow-hidden bg-[#221916] text-white"
      aria-roledescription="carousel"
      aria-label="Promotions"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={slide.imageUrl || slide.title}
          className="absolute inset-0 -z-10"
          initial={reduceMotion ? false : { opacity: 0, scale: 1.025 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.8, ease: [0.76, 0, 0.24, 1] }}
        >
          <Image
            src={heroImageBroken ? '/images/defaults/banner.webp' : slide.imageUrl || '/images/defaults/banner.webp'}
            alt=""
            fill
            priority
            sizes="100vw"
            quality={85}
            className="object-cover"
            onError={() => setHeroImageBroken(true)}
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,10,9,.22)_0%,rgba(15,10,9,.18)_34%,rgba(15,10,9,.85)_100%)]" />
        </motion.div>
      </AnimatePresence>

      <div className="relative mx-auto flex min-h-[min(850px,calc(100svh-4rem))] w-full max-w-[1600px] flex-1 flex-col justify-between px-6 pb-7 pt-16 sm:px-10 sm:pb-9 lg:px-16">
        <div className="flex flex-1 flex-col justify-center pb-64 sm:pb-72">
          {slide.eyebrow ? <p className="mb-5 text-xs tracking-[0.24em] text-white/75 uppercase">{slide.eyebrow}</p> : null}
          <motion.h1
            key={`${index}-title`}
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.5, delay: 0.12 }}
            className="max-w-3xl whitespace-pre-line font-display text-5xl leading-[0.96] font-medium tracking-tight sm:text-6xl lg:text-8xl"
          >
            {slide.title}
          </motion.h1>
          {slide.subtitle ? <p className="mt-5 max-w-xl text-base text-white/80 sm:text-lg">{slide.subtitle}</p> : null}
          <div className="mt-7 flex flex-wrap gap-3">
            <Button size="lg" className={bannerCtaPrimaryClassName} asChild>
              <Link href={slide.ctaPrimaryHref}>{slide.ctaPrimary}</Link>
            </Button>
            {(slide.ctaSecondary || secondaryCta) ? (
              <Button variant="secondary" size="lg" className={bannerCtaSecondaryClassName} asChild>
                <Link href={slide.ctaSecondaryHref || secondaryCta?.href || '/journal'}>
                  {slide.ctaSecondary || secondaryCta?.label}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-7 flex items-end justify-center overflow-hidden px-10 sm:bottom-9 sm:px-16">
          <div className="flex h-[146px] w-full max-w-[660px] items-end justify-center gap-2 sm:h-[178px] sm:gap-3">
            {visibleSlides.map(({ item, offset }) => {
              const active = offset === 0;
              return (
                <button
                  key={`${offset}-${item.title}`}
                  type="button"
                  aria-label={`${active ? 'Current slide' : `Go to slide ${((index + offset + count) % count) + 1}`}: ${item.title.replaceAll('\n', ' ')}`}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => go(index + offset)}
                  className={`group relative shrink-0 overflow-hidden rounded-[3px] bg-white/10 text-left transition-[height,width,opacity,transform] duration-500 ease-[cubic-bezier(.76,0,.24,1)] ${
                    active
                      ? 'z-10 h-[138px] w-[104px] sm:h-[170px] sm:w-[124px]'
                      : 'h-[76px] w-[74px] opacity-70 hover:opacity-100 sm:h-[88px] sm:w-[96px]'
                  }`}
                  style={{ transform: `translateY(${active ? 0 : 0}px)` }}
                >
                  <Image
                    src={item.imageUrl || '/images/defaults/banner.webp'}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 104px, 124px"
                    quality={80}
                    loading={active ? 'eager' : 'lazy'}
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />
                  <span className="absolute bottom-2 start-2 text-[10px] tracking-widest text-white/80">{String(((index + offset + count) % count) + 1).padStart(2, '0')}</span>
                </button>
              );
            })}
          </div>
        </div>

        {count > 1 ? (
          <div className="absolute inset-x-4 bottom-[82px] z-20 flex justify-between sm:inset-x-8 sm:bottom-[100px]">
            <button type="button" aria-label="Previous slide" onClick={() => go(index - 1)} className="rounded-full border border-white/35 bg-black/20 p-2 text-white backdrop-blur transition hover:bg-black/40">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" aria-label="Next slide" onClick={() => go(index + 1)} className="rounded-full border border-white/35 bg-black/20 p-2 text-white backdrop-blur transition hover:bg-black/40">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
