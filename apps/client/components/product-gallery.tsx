'use client';

import { ProductImage } from '@lumea/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

type Image = { id: string; url: string; alt?: string | null };

export function ProductGallery({
  images,
  productName,
  kind = 'PRODUCT',
}: {
  images: Image[];
  productName: string;
  kind?: 'PRODUCT' | 'PACK';
}) {
  const [active, setActive] = useState(0);
  const fallbackKind = kind === 'PACK' ? 'pack' : 'product';
  const image = images[active];
  if (!image) return <ProductImage alt={productName} fallbackKind={fallbackKind} className="rounded-md" priority />;

  function select(next: number) {
    setActive((next + images.length) % images.length);
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-md">
        <div
          className="flex touch-pan-y transition-transform duration-300"
          style={{ transform: `translateX(-${active * 100}%)` }}
          onTouchEnd={(event) => {
            const start = event.currentTarget.dataset.touchStart;
            if (!start) return;
            const delta = event.changedTouches[0]!.clientX - Number(start);
            if (Math.abs(delta) > 40) select(active + (delta < 0 ? 1 : -1));
          }}
          onTouchStart={(event) => {
            event.currentTarget.dataset.touchStart = String(event.touches[0]!.clientX);
          }}
        >
          {images.map((item, index) => (
            <div key={item.id} className="w-full shrink-0">
              <ProductImage
                src={item.url}
                alt={item.alt ?? productName}
                fallbackKind={fallbackKind}
                className="rounded-md"
                priority={index === 0}
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          ))}
        </div>
        {images.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onClick={() => select(active - 1)}
              className="absolute start-3 top-1/2 hidden -translate-y-1/2 rounded-sm bg-background/90 p-2 text-foreground shadow-sm md:block"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={() => select(active + 1)}
              className="absolute end-3 top-1/2 hidden -translate-y-1/2 rounded-sm bg-background/90 p-2 text-foreground shadow-sm md:block"
            >
              <ChevronRight size={20} />
            </button>
            <div
              className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5"
              aria-label={`Image ${active + 1} of ${images.length}`}
            >
              {images.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Show image ${index + 1}`}
                  aria-current={index === active}
                  onClick={() => setActive(index)}
                  className={`h-1.5 w-1.5 rounded-full ${index === active ? 'bg-foreground' : 'bg-background/80'}`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
      {images.length > 1 ? (
        <div className="mt-3 hidden grid-cols-4 gap-2 md:grid">
          {images.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Show image ${index + 1}`}
              aria-current={index === active}
              className={index === active ? 'ring-2 ring-primary' : ''}
            >
              <ProductImage
                src={item.url}
                alt={item.alt ?? productName}
                fallbackKind={fallbackKind}
                className="rounded-sm"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
