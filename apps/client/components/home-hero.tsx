'use client';

import { Button } from '@lumea/ui';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  bannerCtaPrimaryClassName,
  bannerCtaSecondaryClassName,
} from '@/lib/brand-cta';

export type HomeHeroContent = {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaPrimary: string;
  ctaPrimaryHref: string;
  ctaSecondary: string;
  ctaSecondaryHref: string;
  imageUrl?: string | null;
};

export { bannerCtaPrimaryClassName, bannerCtaSecondaryClassName };
export function HomeHero({ content }: { content: HomeHeroContent }) {
  const bgStyle = content.imageUrl
    ? {
        backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0.55)), url(${content.imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {
        background:
          'radial-gradient(ellipse 120% 80% at 50% -20%, var(--accent-soft) 0%, var(--background) 55%, var(--surface-muted) 100%)',
      };

  return (
    <section
      className="relative flex min-h-[calc(100vh-4rem)] flex-col justify-center px-6 py-16"
      style={bgStyle}
    >
      <div className="mx-auto max-w-2xl">
        {content.eyebrow ? (
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-4 text-sm tracking-[0.22em] text-muted-foreground uppercase"
          >
            {content.eyebrow}
          </motion.p>
        ) : null}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.2 }}
          className="font-display mb-5 text-5xl leading-[1.05] font-medium tracking-tight text-foreground md:text-7xl"
        >
          {content.title}
        </motion.h1>
        {content.subtitle ? (
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.35 }}
            className="mb-10 max-w-md text-lg text-muted-foreground"
          >
            {content.subtitle}
          </motion.p>
        ) : null}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="flex flex-wrap gap-3"
        >
          <Button size="lg" className={bannerCtaPrimaryClassName} asChild>
            <Link href={content.ctaPrimaryHref}>{content.ctaPrimary}</Link>
          </Button>
          <Button variant="secondary" size="lg" className={bannerCtaSecondaryClassName} asChild>
            <Link href={content.ctaSecondaryHref}>{content.ctaSecondary}</Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
