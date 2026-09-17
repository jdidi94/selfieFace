import {
  CouponProductScope,
  CouponType,
  JournalArticleStatus,
  Locale,
  ProductStatus,
  type PrismaClient,
} from '@prisma/client';

/** Extra demo products + journals for local/QA testing (idempotent by slug). */
export const DEMO_PRODUCT_SLUGS = [
  'rose-mist-toner',
  'night-recovery-oil',
  'velvet-lip-balm',
  'out-of-stock-cream',
] as const;

export const DEMO_JOURNAL_SLUGS = [
  'morning-barrier-ritual',
  'spf-without-the-white-cast',
] as const;

type DemoProductSpec = {
  name: string;
  slug: string;
  categorySlug: 'skincare' | 'body-care';
  tags: string[];
  stock: number;
  usd: number;
  compareUsd?: number;
  shortDescription: string;
  description: string;
  imageUrl: string;
};

export const demoProducts: DemoProductSpec[] = [
  {
    name: 'Rose Mist Toner',
    slug: 'rose-mist-toner',
    categorySlug: 'skincare',
    tags: ['hydrating', 'toner', 'new'],
    stock: 35,
    usd: 2200,
    shortDescription: 'A soft rose mist to refresh and prep skin.',
    description:
      'A lightly misted toner with rose water for a calm, hydrated feel between cleanse and serum.',
    imageUrl:
      'https://images.unsplash.com/photo-1570194065650-d99fb4b38b17?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'Night Recovery Oil',
    slug: 'night-recovery-oil',
    categorySlug: 'skincare',
    tags: ['serum', 'hydrating'],
    stock: 18,
    usd: 5200,
    compareUsd: 5800,
    shortDescription: 'A cushioned night oil for softer mornings.',
    description:
      'Lightweight botanicals that melt in overnight without a heavy film. Best as the last step at night.',
    imageUrl:
      'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'Velvet Lip Balm',
    slug: 'velvet-lip-balm',
    categorySlug: 'body-care',
    tags: ['hydrating', 'new'],
    stock: 60,
    usd: 1400,
    shortDescription: 'Soft balm with a quiet sheen.',
    description: 'Everyday lip comfort in a slim stick — layers under color or alone.',
    imageUrl:
      'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'Cloud Soft Cream',
    slug: 'out-of-stock-cream',
    categorySlug: 'skincare',
    tags: ['hydrating', 'cream'],
    stock: 0,
    usd: 3900,
    shortDescription: 'Currently out of stock — still listed for wishlist & restock interest.',
    description:
      'A cloud-soft moisturizer kept visible on the storefront when inventory hits zero, with purchase blocked.',
    imageUrl:
      'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=1200&q=80',
  },
];

function pricesFromUsd(usd: number, compareAtUsd?: number) {
  return [
    { currency: 'USD' as const, amount: usd, compareAtAmount: compareAtUsd ?? null },
    {
      currency: 'TND' as const,
      amount: Math.round(usd * 3.1),
      compareAtAmount: compareAtUsd != null ? Math.round(compareAtUsd * 3.1) : null,
    },
    {
      currency: 'AED' as const,
      amount: Math.round(usd * 3.67),
      compareAtAmount: compareAtUsd != null ? Math.round(compareAtUsd * 3.67) : null,
    },
  ];
}

export async function seedDemoCatalog(prisma: PrismaClient) {
  const otherMarket = await prisma.market.findUniqueOrThrow({ where: { code: 'OTHER' } });
  const markets = await prisma.market.findMany({ orderBy: { code: 'asc' } });

  const brand = await prisma.brand.findUnique({
    where: { marketId_slug: { marketId: otherMarket.id, slug: 'lumea' } },
  });
  const skincare = await prisma.category.findUnique({
    where: { marketId_slug: { marketId: otherMarket.id, slug: 'skincare' } },
  });
  const bodyCare = await prisma.category.findUnique({
    where: { marketId_slug: { marketId: otherMarket.id, slug: 'body-care' } },
  });
  if (!brand || !skincare || !bodyCare) {
    console.warn('Demo catalog skipped: base brand/categories missing (run core seed first)');
    return;
  }

  const categoryId = (slug: 'skincare' | 'body-care') =>
    slug === 'skincare' ? skincare.id : bodyCare.id;

  for (const p of demoProducts) {
    const existing = await prisma.product.findUnique({ where: { marketId_slug: { marketId: otherMarket.id, slug: p.slug } } });
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          name: p.name,
          status: ProductStatus.ACTIVE,
          shortDescription: p.shortDescription,
          description: p.description,
          tags: p.tags,
        },
      });
      const variant = await prisma.productVariant.findFirst({
        where: { productId: existing.id },
      });
      if (variant) {
        await prisma.productVariant.update({
          where: { id: variant.id },
          data: { stock: p.stock },
        });
      }
      continue;
    }

    const created = await prisma.product.create({
      data: {
        name: p.name,
        slug: p.slug,
        status: ProductStatus.ACTIVE,
        shortDescription: p.shortDescription,
        description: p.description,
        categoryId: categoryId(p.categorySlug),
        brandId: brand.id,
        marketId: otherMarket.id,
        tags: p.tags,
        translations: {
          create: [
            {
              locale: Locale.en,
              name: p.name,
              shortDescription: p.shortDescription,
              description: p.description,
            },
            {
              locale: Locale.ar,
              name: p.name,
              shortDescription: p.shortDescription,
              description: p.description,
            },
            {
              locale: Locale.fr,
              name: p.name,
              shortDescription: p.shortDescription,
              description: p.description,
            },
          ],
        },
        variants: {
          create: [
            {
              name: 'Default',
              sku: `LUM-DEMO-${p.slug.slice(0, 12).toUpperCase()}`,
              stock: p.stock,
              isActive: true,
              prices: { create: pricesFromUsd(p.usd, p.compareUsd) },
            },
          ],
        },
      },
    });

    const media = await prisma.media.create({
      data: {
        filename: `${p.slug}.jpg`,
        mimeType: 'image/jpeg',
        size: 0,
        path: p.imageUrl,
        url: p.imageUrl,
      },
    });
    await prisma.productImage.create({
      data: { productId: created.id, mediaId: media.id, sortOrder: 0, alt: p.name },
    });
  }

  // Tag core catalog products for coupon rule demos
  const tagUpdates: { slug: string; tags: string[] }[] = [
    { slug: 'hydrating-body-lotion', tags: ['hydrating', 'body'] },
    { slug: 'gentle-cream-cleanser', tags: ['cleanser', 'hydrating'] },
    { slug: 'barrier-repair-serum', tags: ['serum', 'hydrating'] },
    { slug: 'daily-mineral-spf-30', tags: ['spf', 'new'] },
  ];
  for (const row of tagUpdates) {
    await prisma.product.updateMany({
      where: { marketId: otherMarket.id, slug: row.slug },
      data: { tags: row.tags },
    });
  }

  const lotion = await prisma.product.findUnique({
    where: { marketId_slug: { marketId: otherMarket.id, slug: 'hydrating-body-lotion' } },
    select: { id: true },
  });
  const serum = await prisma.product.findUnique({
    where: { marketId_slug: { marketId: otherMarket.id, slug: 'barrier-repair-serum' } },
    select: { id: true },
  });
  const spf = await prisma.product.findUnique({
    where: { marketId_slug: { marketId: otherMarket.id, slug: 'daily-mineral-spf-30' } },
    select: { id: true },
  });
  const mist = await prisma.product.findUnique({
    where: { marketId_slug: { marketId: otherMarket.id, slug: 'rose-mist-toner' } },
    select: { id: true },
  });

  const journalSpecs = [
    {
      slug: 'morning-barrier-ritual',
      coverUrl:
        'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1600&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?auto=format&fit=crop&w=1200&q=80',
      ],
      productIds: [serum?.id, lotion?.id].filter(Boolean) as string[],
      title: 'Morning barrier ritual',
      excerpt: 'A quiet three-step cleanse, treat, and seal for calmer skin.',
      body: `Start with lukewarm water and a cream cleanser. Pat dry, then press a few drops of serum into damp skin.

Watch a short barrier overview:
https://www.youtube.com/watch?v=dQw4w9WgXcQ

Finish with moisturizer, then SPF if you are heading out. For more ingredient notes, see:
https://lumea.local/journal

Keep layers light — comfort first, then glow.`,
    },
    {
      slug: 'spf-without-the-white-cast',
      coverUrl:
        'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?auto=format&fit=crop&w=1600&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1200&q=80',
      ],
      productIds: [spf?.id, mist?.id].filter(Boolean) as string[],
      title: 'SPF without the white cast',
      excerpt: 'How we wear mineral SPF under everyday light.',
      body: `Mineral SPF can look sheer when you warm a pea-sized amount between fingers before pressing onto the face.

Apply after moisturizer, wait a minute, then makeup if you use it. Reapply on long outdoor days.

https://www.youtube.com/watch?v=aqz-KE-bpKQ`,
    },
  ];

  for (const spec of journalSpecs) {
    for (const market of markets) {
      const cover = await prisma.media.create({
        data: {
          filename: `${spec.slug}-${market.code}-cover.jpg`,
          mimeType: 'image/jpeg',
          size: 0,
          path: spec.coverUrl,
          url: spec.coverUrl,
        },
      });

      const existing = await prisma.journalArticle.findUnique({
        where: { marketId_slug: { marketId: market.id, slug: spec.slug } },
      });
      let articleId: string;
      if (existing) {
        articleId = existing.id;
        await prisma.journalArticle.update({
          where: { id: existing.id },
          data: {
            status: JournalArticleStatus.PUBLISHED,
            publishedAt: existing.publishedAt ?? new Date(),
            coverMediaId: cover.id,
          },
        });
        await prisma.journalArticleTranslation.upsert({
          where: { articleId_locale: { articleId: existing.id, locale: Locale.en } },
          create: {
            articleId: existing.id,
            locale: Locale.en,
            title: spec.title,
            excerpt: spec.excerpt,
            body: spec.body,
          },
          update: {
            title: spec.title,
            excerpt: spec.excerpt,
            body: spec.body,
          },
        });
        await prisma.journalArticleImage.deleteMany({ where: { articleId: existing.id } });
        await prisma.journalArticleProduct.deleteMany({ where: { articleId: existing.id } });
      } else {
        const created = await prisma.journalArticle.create({
          data: {
            slug: spec.slug,
            status: JournalArticleStatus.PUBLISHED,
            publishedAt: new Date(),
            coverMediaId: cover.id,
            marketId: market.id,
            translations: {
              create: [
                {
                  locale: Locale.en,
                  title: spec.title,
                  excerpt: spec.excerpt,
                  body: spec.body,
                },
                {
                  locale: Locale.fr,
                  title: spec.title,
                  excerpt: spec.excerpt,
                  body: spec.body,
                },
                {
                  locale: Locale.ar,
                  title: spec.title,
                  excerpt: spec.excerpt,
                  body: spec.body,
                },
              ],
            },
          },
        });
        articleId = created.id;
      }

      for (let i = 0; i < spec.galleryUrls.length; i++) {
        const url = spec.galleryUrls[i]!;
        const media = await prisma.media.create({
          data: {
            filename: `${spec.slug}-${market.code}-g${i + 1}.jpg`,
            mimeType: 'image/jpeg',
            size: 0,
            path: url,
            url,
          },
        });
        await prisma.journalArticleImage.create({
          data: { articleId, mediaId: media.id, sortOrder: i },
        });
      }

      // Recommended products only on OTHER — AE/TN catalogs start empty.
      if (market.code === 'OTHER' && spec.productIds.length) {
        await prisma.journalArticleProduct.createMany({
          data: spec.productIds.map((productId, index) => ({
            articleId,
            productId,
            sortOrder: index,
          })),
          skipDuplicates: true,
        });
      }
    }
  }

  await prisma.coupon.upsert({
    where: { marketId_code: { marketId: otherMarket.id, code: 'SPF15' } },
    update: {
      type: CouponType.PERCENT,
      percentOff: 15,
      productScope: CouponProductScope.INCLUDE,
      productTags: ['spf'],
      productIds: [],
      ruleIsNew: false,
      ruleMinPriceUsd: null,
      ruleMinRating: null,
      isActive: true,
    },
    create: {
      code: 'SPF15',
      marketId: otherMarket.id,
      type: CouponType.PERCENT,
      percentOff: 15,
      productScope: CouponProductScope.INCLUDE,
      productTags: ['spf'],
      isActive: true,
    },
  });

  await prisma.coupon.upsert({
    where: { marketId_code: { marketId: otherMarket.id, code: 'NOTNEW' } },
    update: {
      type: CouponType.PERCENT,
      percentOff: 5,
      productScope: CouponProductScope.EXCLUDE,
      productTags: ['new'],
      isActive: true,
    },
    create: {
      code: 'NOTNEW',
      marketId: otherMarket.id,
      type: CouponType.PERCENT,
      percentOff: 5,
      productScope: CouponProductScope.EXCLUDE,
      productTags: ['new'],
      isActive: true,
    },
  });

  console.log(
    `Seeded demo catalog: ${DEMO_PRODUCT_SLUGS.length} products, ${DEMO_JOURNAL_SLUGS.length} journals, coupons SPF15 / NOTNEW`,
  );
}
