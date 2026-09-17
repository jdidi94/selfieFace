'use client';

import { LocaleLink } from '@/components/locale-link';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import type { CatalogCategory } from '@lumea/types';
import { Button } from '@lumea/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type TouchEvent } from 'react';

const MOBILE_PAGE_SIZE = 3;
const DESKTOP_PAGE_SIZE = 6;
const SWIPE_THRESHOLD_PX = 48;

function chunkCategories(items: CatalogCategory[], size: number): CatalogCategory[][] {
  if (size <= 0) return [items];
  const pages: CatalogCategory[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages.length > 0 ? pages : [[]];
}

function CategoryTile({ category }: { category: CatalogCategory }) {
  return (
    <LocaleLink
      href={`/shop?category=${encodeURIComponent(category.slug)}`}
      className="group border border-border bg-surface px-5 py-6 transition-colors hover:border-accent hover:bg-surface-muted/40"
    >
      <span className="font-display text-2xl text-foreground">{category.name}</span>
      {category.description ? (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{category.description}</p>
      ) : null}
    </LocaleLink>
  );
}

function CategoriesCarouselTrack({
  categories,
  pageSize,
  gridClassName,
}: {
  categories: CatalogCategory[];
  pageSize: number;
  gridClassName: string;
}) {
  const { locale, dir } = useLocale();
  const t = getMessages(locale);
  const [page, setPage] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const pages = useMemo(() => chunkCategories(categories, pageSize), [categories, pageSize]);
  const pageCount = pages.length;

  useEffect(() => {
    setPage((current) => Math.min(current, Math.max(pageCount - 1, 0)));
  }, [pageCount]);

  const goTo = useCallback(
    (next: number) => {
      if (pageCount <= 1) return;
      setPage(((next % pageCount) + pageCount) % pageCount);
    },
    [pageCount],
  );

  const goPrev = useCallback(() => goTo(page - 1), [goTo, page]);
  const goNext = useCallback(() => goTo(page + 1), [goTo, page]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (pageCount <= 1) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (dir === 'rtl') goNext();
        else goPrev();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (dir === 'rtl') goPrev();
        else goNext();
      }
    },
    [dir, goNext, goPrev, pageCount],
  );

  const onTouchStart = useCallback((event: TouchEvent) => {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
  }, []);

  const onTouchEnd = useCallback(
    (event: TouchEvent) => {
      if (touchStartX.current == null || pageCount <= 1) return;
      const endX = event.changedTouches[0]?.clientX;
      if (endX == null) return;
      const delta = endX - touchStartX.current;
      touchStartX.current = null;
      if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
      const swipedTowardStart = delta > 0;
      if (dir === 'rtl') {
        if (swipedTowardStart) goNext();
        else goPrev();
      } else if (swipedTowardStart) {
        goPrev();
      } else {
        goNext();
      }
    },
    [dir, goNext, goPrev, pageCount],
  );

  const offsetPercent = dir === 'rtl' ? page * 100 : -page * 100;

  return (
    <div
      className="outline-none"
      role="region"
      aria-roledescription="carousel"
      aria-label={t.categoriesTitle}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(${offsetPercent}%)` }}
        >
          {pages.map((pageItems, pageIndex) => (
            <div
              key={pageIndex}
              className="w-full shrink-0"
              role="group"
              aria-roledescription="slide"
              aria-label={t.pageOf(pageIndex + 1, pageCount)}
              aria-hidden={pageIndex !== page}
              // Prevent tabbing into off-screen category links
              {...(pageIndex !== page ? { inert: true } : {})}
            >
              <div className={gridClassName}>
                {pageItems.map((category) => (
                  <CategoryTile key={category.id} category={category} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {pageCount > 1 ? (
        <div className="mt-6 flex items-center justify-between gap-4">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={goPrev}
            aria-label={t.previous}
          >
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          </Button>

          <div className="flex items-center gap-2">
            {pages.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={t.pageOf(i + 1, pageCount)}
                aria-current={i === page ? 'true' : undefined}
                onClick={() => setPage(i)}
                className={`h-2 w-2 rounded-full transition ${
                  i === page ? 'bg-accent' : 'bg-foreground/25 hover:bg-foreground/40'
                }`}
              />
            ))}
          </div>

          <Button type="button" variant="outline" size="icon" onClick={goNext} aria-label={t.next}>
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function CategoriesCarousel({ categories }: { categories: CatalogCategory[] }) {
  if (categories.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="md:hidden">
        <CategoriesCarouselTrack
          categories={categories}
          pageSize={MOBILE_PAGE_SIZE}
          gridClassName="grid grid-cols-1 gap-4"
        />
      </div>
      <div className="hidden md:block">
        <CategoriesCarouselTrack
          categories={categories}
          pageSize={DESKTOP_PAGE_SIZE}
          gridClassName="grid grid-cols-3 gap-4"
        />
      </div>
    </div>
  );
}
