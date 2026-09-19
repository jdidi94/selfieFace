'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useLayoutEffect } from 'react';

const useIsoLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function scrollWindowToTop() {
  // Skip in-page anchors (e.g. /shop#filters).
  if (typeof window === 'undefined') return;
  if (window.location.hash) return;
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

/**
 * Soft enter/exit for storefront route changes.
 * Header/footer stay mounted; only page content animates.
 * Also resets window scroll — App Router + middleware rewrites often leave
 * the previous page's scroll offset when navigating.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  useIsoLayoutEffect(() => {
    scrollWindowToTop();
  }, [pathname]);

  if (reduceMotion) {
    return <div className="min-h-[50vh]">{children}</div>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        className="min-h-[50vh]"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        onAnimationStart={scrollWindowToTop}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
