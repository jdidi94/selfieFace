import {
  AdminRole,
  CouponType,
  Currency,
  MarketCode,
  Locale,
  MerchandisingRailKind,
  OrderStatus,
  OrderTimelineActorType,
  PaymentStatus,
  PrismaClient,
  ProductStatus,
  PromoBannerPlacement,
  ReviewStatus,
  ShippingZone,
  UserType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function pricesFromUsd(usd: number, compareAtUsd?: number) {
  return [
    {
      currency: Currency.USD,
      amount: usd,
      compareAtAmount: compareAtUsd ?? null,
    },
    {
      currency: Currency.TND,
      amount: Math.round(usd * 3.1),
      compareAtAmount: compareAtUsd != null ? Math.round(compareAtUsd * 3.1) : null,
    },
    {
      currency: Currency.AED,
      amount: Math.round(usd * 3.67),
      compareAtAmount: compareAtUsd != null ? Math.round(compareAtUsd * 3.67) : null,
    },
  ];
}

async function upsertCategoryTranslations(
  categoryId: string,
  rows: { locale: Locale; name: string; description?: string }[],
) {
  for (const row of rows) {
    await prisma.categoryTranslation.upsert({
      where: { categoryId_locale: { categoryId, locale: row.locale } },
      create: {
        categoryId,
        locale: row.locale,
        name: row.name,
        description: row.description ?? null,
      },
      update: {
        name: row.name,
        description: row.description ?? null,
      },
    });
  }
}

async function upsertBrandTranslations(
  brandId: string,
  rows: { locale: Locale; name: string; description?: string }[],
) {
  for (const row of rows) {
    await prisma.brandTranslation.upsert({
      where: { brandId_locale: { brandId, locale: row.locale } },
      create: {
        brandId,
        locale: row.locale,
        name: row.name,
        description: row.description ?? null,
      },
      update: {
        name: row.name,
        description: row.description ?? null,
      },
    });
  }
}

async function main() {
  const email = 'admin@lumea.local';
  const password = 'SelfiefaceAdmin123!';
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      type: UserType.ADMIN,
      adminRole: AdminRole.SUPER_ADMIN,
      firstName: 'Super',
      lastName: 'Admin',
      emailVerifiedAt: new Date(),
    },
    create: {
      email,
      passwordHash,
      type: UserType.ADMIN,
      adminRole: AdminRole.SUPER_ADMIN,
      firstName: 'Super',
      lastName: 'Admin',
      emailVerifiedAt: new Date(),
    },
  });

  console.log(`Seeded admin: ${email} / ${password}`);

  const marketSeeds = [
    { id: 'market_ae', code: 'AE' as const, name: 'Emirates', currency: Currency.AED },
    { id: 'market_tn', code: 'TN' as const, name: 'Tunisia', currency: Currency.TND },
    { id: 'market_other', code: 'OTHER' as const, name: 'Rest of world', currency: Currency.USD },
  ];
  for (const m of marketSeeds) {
    await prisma.market.upsert({
      where: { code: m.code },
      create: { id: m.id, code: m.code, name: m.name, currency: m.currency, enabled: true },
      update: { name: m.name, currency: m.currency },
    });
    await prisma.storeSettings.upsert({
      where: { id: m.code },
      create: { id: m.code, marketId: m.id },
      update: {},
    });
  }

  // Prefer OTHER as the default catalog window for seeded products.
  const otherMarket = await prisma.market.findUniqueOrThrow({ where: { code: 'OTHER' } });
  const allMarkets = await prisma.market.findMany({ orderBy: { code: 'asc' } });

  // Remove legacy single-row settings if still present
  await prisma.storeSettings.deleteMany({ where: { id: 'default' } }).catch(() => undefined);

  const shippingDefaults = [
    {
      code: 'STANDARD',
      name: 'Standard',
      description: 'Economy delivery',
      priceByCurrency: { USD: 500, TND: 1500, AED: 2000 } as const,
      sortOrder: 1,
      eligibleForFreeShipping: true,
      estimatedDaysMin: 3,
      estimatedDaysMax: 7,
    },
    {
      code: 'EXPRESS',
      name: 'Express',
      description: 'Faster delivery',
      priceByCurrency: { USD: 1200, TND: 3500, AED: 4500 } as const,
      sortOrder: 2,
      eligibleForFreeShipping: false,
      estimatedDaysMin: 1,
      estimatedDaysMax: 3,
    },
    {
      code: 'PRIORITY',
      name: 'Priority',
      description: 'Next-day style delivery',
      priceByCurrency: { USD: 2000, TND: 6000, AED: 7500 } as const,
      sortOrder: 3,
      eligibleForFreeShipping: false,
      estimatedDaysMin: 1,
      estimatedDaysMax: 1,
    },
  ] as const;

  for (const market of allMarkets) {
    for (const method of shippingDefaults) {
      const price =
        market.currency === Currency.AED
          ? method.priceByCurrency.AED
          : market.currency === Currency.TND
            ? method.priceByCurrency.TND
            : method.priceByCurrency.USD;
      await prisma.shippingMethod.upsert({
        where: { marketId_code: { marketId: market.id, code: method.code } },
        create: {
          code: method.code,
          name: method.name,
          description: method.description,
          price,
          sortOrder: method.sortOrder,
          eligibleForFreeShipping: method.eligibleForFreeShipping,
          estimatedDaysMin: method.estimatedDaysMin,
          estimatedDaysMax: method.estimatedDaysMax,
          marketId: market.id,
        },
        update: {
          name: method.name,
          description: method.description,
          price,
          sortOrder: method.sortOrder,
          eligibleForFreeShipping: method.eligibleForFreeShipping,
          estimatedDaysMin: method.estimatedDaysMin,
          estimatedDaysMax: method.estimatedDaysMax,
          isActive: true,
        },
      });
    }
  }

  async function upsertBrandForMarket(marketId: string) {
    return prisma.brand.upsert({
      where: { marketId_slug: { marketId, slug: 'lumea' } },
      update: {
        name: 'Selfieface',
        description: 'Calm editorial beauty — skincare-led rituals.',
        imageUrl:
          'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=160&q=80',
      },
      create: {
        name: 'Selfieface',
        slug: 'lumea',
        description: 'Calm editorial beauty — skincare-led rituals.',
        imageUrl:
          'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=160&q=80',
        marketId,
      },
    });
  }

  const brandByMarket = new Map<string, Awaited<ReturnType<typeof upsertBrandForMarket>>>();
  for (const market of allMarkets) {
    const brandRow = await upsertBrandForMarket(market.id);
    brandByMarket.set(market.id, brandRow);
    await upsertBrandTranslations(brandRow.id, [
      {
        locale: Locale.en,
        name: 'Selfieface',
        description: 'Calm editorial beauty — skincare-led rituals.',
      },
      {
        locale: Locale.ar,
        name: 'Selfieface',
        description: 'جمال تحريري هادئ — طقوس عناية بالبشرة.',
      },
      {
        locale: Locale.fr,
        name: 'Selfieface',
        description: 'Beauté éditoriale apaisée — rituels skincare.',
      },
    ]);
  }
  const brand = brandByMarket.get(otherMarket.id)!;

  async function upsertCategoryForMarket(
    marketId: string,
    slug: string,
    name: string,
    description: string,
    sortOrder: number,
  ) {
    return prisma.category.upsert({
      where: { marketId_slug: { marketId, slug } },
      update: { name, description, sortOrder },
      create: { name, slug, description, sortOrder, marketId },
    });
  }

  const skincareByMarket = new Map<string, { id: string }>();
  const bodyCareByMarket = new Map<string, { id: string }>();
  for (const market of allMarkets) {
    const skincareRow = await upsertCategoryForMarket(
      market.id,
      'skincare',
      'Skincare',
      'Cleansers, treatments, moisturizers, SPF',
      1,
    );
    skincareByMarket.set(market.id, skincareRow);
    await upsertCategoryTranslations(skincareRow.id, [
      {
        locale: Locale.en,
        name: 'Skincare',
        description: 'Cleansers, treatments, moisturizers, SPF',
      },
      {
        locale: Locale.ar,
        name: 'العناية بالبشرة',
        description: 'منظفات، علاجات، مرطبات، واقي شمس',
      },
      {
        locale: Locale.fr,
        name: 'Soins de la peau',
        description: 'Nettoyants, traitements, hydratants, SPF',
      },
    ]);

    const bodyCareRow = await upsertCategoryForMarket(
      market.id,
      'body-care',
      'Body care',
      'Lotions, oils, washes',
      2,
    );
    bodyCareByMarket.set(market.id, bodyCareRow);
    await upsertCategoryTranslations(bodyCareRow.id, [
      {
        locale: Locale.en,
        name: 'Body care',
        description: 'Lotions, oils, washes',
      },
      {
        locale: Locale.ar,
        name: 'العناية بالجسم',
        description: 'لوشن، زيوت، غسولات',
      },
      {
        locale: Locale.fr,
        name: 'Soins du corps',
        description: 'Lotions, huiles, lavages',
      },
    ]);
  }
  const skincare = skincareByMarket.get(otherMarket.id)!;
  const bodyCare = bodyCareByMarket.get(otherMarket.id)!;

  const products = [
    {
      name: 'Hydrating Body Lotion',
      slug: 'hydrating-body-lotion',
      categoryId: bodyCare.id,
      translations: [
        {
          locale: Locale.en,
          name: 'Hydrating Body Lotion',
          shortDescription: 'A silky daily lotion that softens without heaviness.',
          description:
            'Formulated for everyday comfort, this lotion layers quietly under clothes and leaves skin calm and cushioned.',
          benefits: 'Long-lasting softness\nNon-greasy finish\nSuitable for morning and night',
          howToUse: 'Apply to clean, dry skin after bathing. Massage until absorbed.',
          suitableFor: 'Normal to dry skin; all seasons',
        },
        {
          locale: Locale.ar,
          name: 'لوشن مرطب للجسم',
          shortDescription: 'لوشن يومي حريري ينعم دون ثقل.',
          description:
            'مصمم للراحة اليومية؛ يمتص بهدوء تحت الملابس ويترك البشرة هادئة ومخملية.',
          benefits: 'نعومة تدوم\nملمس غير دهني\nمناسب صباحاً ومساءً',
          howToUse: 'يُوضع على بشرة نظيفة وجافة بعد الاستحمام. دلكي حتى الامتصاص.',
          suitableFor: 'البشرة العادية إلى الجافة؛ كل الفصول',
        },
        {
          locale: Locale.fr,
          name: 'Lotion corporelle hydratante',
          shortDescription: 'Une lotion quotidienne soyeuse qui adoucit sans lourdeur.',
          description:
            'Pensée pour le confort de tous les jours, elle se glisse sous les vêtements et laisse la peau calme et souple.',
          benefits: 'Douceur durable\nFini non gras\nMatin et soir',
          howToUse: 'Appliquer sur peau propre et sèche après la douche. Masser jusqu’à absorption.',
          suitableFor: 'Peaux normales à sèches ; toutes saisons',
        },
      ],
      variants: [
        { name: '250ml', sku: 'LUM-HBL-250', usd: 2800, compareUsd: 3200, stock: 40, weightGrams: 280 },
        { name: '500ml', sku: 'LUM-HBL-500', usd: 4200, stock: 25, weightGrams: 540 },
      ],
    },
    {
      name: 'Gentle Cream Cleanser',
      slug: 'gentle-cream-cleanser',
      categoryId: skincare.id,
      translations: [
        {
          locale: Locale.en,
          name: 'Gentle Cream Cleanser',
          shortDescription: 'A creamy cleanse that removes the day without stripping.',
          description: 'Soft surfactants meet calming botanicals for a rinse that leaves skin comfortable.',
          benefits: 'Removes SPF and light makeup\nMaintains moisture barrier\nFragrance-light',
          howToUse: 'Massage onto damp skin, then rinse with lukewarm water. Use morning and evening.',
          suitableFor: 'Sensitive and combination skin',
        },
        {
          locale: Locale.ar,
          name: 'منظف كريمي لطيف',
          shortDescription: 'تنظيف كريمي يزيل آثار اليوم دون تجفيف.',
          description: 'مواد تنظيف لطيفة ونباتات مهدئة لشطف يترك البشرة مرتاحة.',
          benefits: 'يزيل واقي الشمس والمكياج الخفيف\nيحافظ على حاجز الرطوبة\nعطر خفيف',
          howToUse: 'دلكي على بشرة رطبة ثم اشطفي بماء فاتر. صباحاً ومساءً.',
          suitableFor: 'البشرة الحساسة والمختلطة',
        },
        {
          locale: Locale.fr,
          name: 'Nettoyant crème doux',
          shortDescription: 'Un nettoyage crémeux qui retire la journée sans agresser.',
          description: 'Surfactants doux et botaniques apaisants pour une peau confortable.',
          benefits: 'Retire SPF et maquillage léger\nPréserve la barrière\nParfum léger',
          howToUse: 'Masser sur peau humide, rincer à l’eau tiède. Matin et soir.',
          suitableFor: 'Peaux sensibles et mixtes',
        },
      ],
      variants: [
        { name: '150ml', sku: 'LUM-GCC-150', usd: 2400, stock: 50, weightGrams: 180 },
      ],
    },
    {
      name: 'Barrier Repair Serum',
      slug: 'barrier-repair-serum',
      competitorPriceUsd: 5600,
      competitorPriceSource: 'Comparable retailers',
      categoryId: skincare.id,
      translations: [
        {
          locale: Locale.en,
          name: 'Barrier Repair Serum',
          shortDescription: 'A lightweight serum for resilient, calm-looking skin.',
          description: 'Supports the skin barrier with a quiet, non-sticky texture that layers well.',
          benefits: 'Supports barrier comfort\nLayers under moisturizer\nQuick absorb',
          howToUse: 'Apply 2–3 drops after cleansing, before moisturizer.',
          suitableFor: 'Dry, stressed, or recovering skin',
        },
        {
          locale: Locale.ar,
          name: 'سيروم ترميم الحاجز',
          shortDescription: 'سيروم خفيف لبشرة هادئة وأكثر مرونة.',
          description: 'يدعم حاجز البشرة بملمس هادئ غير لزج يتركب جيداً.',
          benefits: 'راحة الحاجز\nتحت المرطب\nامتصاص سريع',
          howToUse: 'ضعي ٢–٣ قطرات بعد التنظيف وقبل المرطب.',
          suitableFor: 'البشرة الجافة أو المجهدة أو المتعافية',
        },
        {
          locale: Locale.fr,
          name: 'Sérum réparation barrière',
          shortDescription: 'Un sérum léger pour une peau calme et résiliente.',
          description: 'Soutient la barrière cutanée avec une texture discrète, non collante.',
          benefits: 'Confort de la barrière\nSous l’hydratant\nAbsorption rapide',
          howToUse: 'Appliquer 2–3 gouttes après le nettoyage, avant l’hydratant.',
          suitableFor: 'Peaux sèches, stressées ou en récupération',
        },
      ],
      variants: [
        { name: '30ml', sku: 'LUM-BRS-30', usd: 4800, compareUsd: 5400, stock: 30, weightGrams: 60 },
      ],
    },
    {
      name: 'Daily Mineral SPF 30',
      slug: 'daily-mineral-spf-30',
      competitorPriceUsd: 4200,
      competitorPriceSource: 'Comparable retailers',
      categoryId: skincare.id,
      translations: [
        {
          locale: Locale.en,
          name: 'Daily Mineral SPF 30',
          shortDescription: 'Sheer mineral protection for everyday light.',
          description: 'A soft mineral SPF designed for daily wear under makeup or alone.',
          benefits: 'Broad-spectrum SPF 30\nSheer finish\nMakeup-friendly',
          howToUse: 'Apply as the last step of morning skincare. Reapply as needed.',
          suitableFor: 'All skin types seeking everyday SPF',
        },
        {
          locale: Locale.ar,
          name: 'واقي شمس معدني يومي ٣٠',
          shortDescription: 'حماية معدنية خفيفة لضوء النهار اليومي.',
          description: 'واقي معدني ناعم للاستخدام اليومي تحت المكياج أو بمفرده.',
          benefits: 'حماية واسعة SPF 30\nلمسة شفافة\nيناسب المكياج',
          howToUse: 'آخر خطوة في روتين الصباح. أعيدي التطبيق عند الحاجة.',
          suitableFor: 'كل أنواع البشرة للحماية اليومية',
        },
        {
          locale: Locale.fr,
          name: 'SPF 30 minéral quotidien',
          shortDescription: 'Protection minérale légère pour la lumière du quotidien.',
          description: 'Un SPF minéral doux conçu pour le quotidien, seul ou sous le maquillage.',
          benefits: 'SPF 30 large spectre\nFini transparent\nCompatible maquillage',
          howToUse: 'Dernière étape du soin du matin. Réappliquer au besoin.',
          suitableFor: 'Tous types de peau pour un SPF quotidien',
        },
      ],
      variants: [
        { name: '50ml', sku: 'LUM-SPF-50', usd: 3600, stock: 45, weightGrams: 80 },
      ],
    },
  ];

  for (const p of products) {
    const en = p.translations.find((t) => t.locale === Locale.en)!;
    const existing = await prisma.product.findUnique({ where: { marketId_slug: { marketId: otherMarket.id, slug: p.slug } } });

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          name: en.name,
          shortDescription: en.shortDescription,
          description: en.description,
          benefits: en.benefits,
          howToUse: en.howToUse,
          suitableFor: en.suitableFor,
          competitorPriceAmount: p.competitorPriceUsd ?? null,
          competitorPriceSource: p.competitorPriceSource ?? null,
          competitorPriceCheckedAt: p.competitorPriceUsd ? new Date() : null,
        },
      });
      for (const t of p.translations) {
        await prisma.productTranslation.upsert({
          where: {
            productId_locale: { productId: existing.id, locale: t.locale },
          },
          create: {
            productId: existing.id,
            locale: t.locale,
            name: t.name,
            shortDescription: t.shortDescription,
            description: t.description,
            benefits: t.benefits,
            howToUse: t.howToUse,
            suitableFor: t.suitableFor,
          },
          update: {
            name: t.name,
            shortDescription: t.shortDescription,
            description: t.description,
            benefits: t.benefits,
            howToUse: t.howToUse,
            suitableFor: t.suitableFor,
          },
        });
      }
      continue;
    }

    await prisma.product.create({
      data: {
        name: en.name,
        slug: p.slug,
        status: ProductStatus.ACTIVE,
        shortDescription: en.shortDescription,
        description: en.description,
        benefits: en.benefits,
        howToUse: en.howToUse,
        suitableFor: en.suitableFor,
        competitorPriceAmount: p.competitorPriceUsd ?? null,
        competitorPriceSource: p.competitorPriceSource ?? null,
        competitorPriceCheckedAt: p.competitorPriceUsd ? new Date() : null,
        categoryId: p.categoryId,
        brandId: brand.id,
        marketId: otherMarket.id,
        translations: {
          create: p.translations.map((t) => ({
            locale: t.locale,
            name: t.name,
            shortDescription: t.shortDescription,
            description: t.description,
            benefits: t.benefits,
            howToUse: t.howToUse,
            suitableFor: t.suitableFor,
          })),
        },
        variants: {
          create: p.variants.map((v) => ({
            name: v.name,
            sku: v.sku,
            stock: v.stock,
            weightGrams: v.weightGrams,
            isActive: true,
            prices: {
              create: pricesFromUsd(v.usd, v.compareUsd),
            },
          })),
        },
      },
    });
  }

  const productImages: Record<string, { url: string; alt: string }[]> = {
    'hydrating-body-lotion': [
      {
        url: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&w=1200&q=80',
        alt: 'Hydrating body lotion bottle on linen',
      },
      {
        url: 'https://images.unsplash.com/photo-1571781926291-c77df46a9a55?auto=format&fit=crop&w=1200&q=80',
        alt: 'Soft skincare texture close-up',
      },
    ],
    'gentle-cream-cleanser': [
      {
        url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=1200&q=80',
        alt: 'Cream cleanser jar on marble',
      },
    ],
    'barrier-repair-serum': [
      {
        url: 'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?auto=format&fit=crop&w=1200&q=80',
        alt: 'Dropper serum bottle in soft light',
      },
      {
        url: 'https://images.unsplash.com/photo-1620916297397-a4a3322f5eca?auto=format&fit=crop&w=1200&q=80',
        alt: 'Skincare bottles on a vanity',
      },
    ],
    'daily-mineral-spf-30': [
      {
        url: 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?auto=format&fit=crop&w=1200&q=80',
        alt: 'Mineral SPF tube outdoors',
      },
    ],
  };

  for (const [slug, images] of Object.entries(productImages)) {
    const product = await prisma.product.findUnique({
      where: { marketId_slug: { marketId: otherMarket.id, slug } },
      include: { images: { include: { media: true } } },
    });
    if (!product) continue;

    const hasRemote = product.images.some((img) => img.media.url.startsWith('http'));
    if (hasRemote && product.images.length > 0) continue;

    for (const img of product.images) {
      await prisma.productImage.delete({ where: { id: img.id } });
      await prisma.media.delete({ where: { id: img.mediaId } }).catch(() => undefined);
    }

    for (let i = 0; i < images.length; i++) {
      const row = images[i]!;
      const media = await prisma.media.create({
        data: {
          filename: `${slug}-${i + 1}.jpg`,
          mimeType: 'image/jpeg',
          size: 0,
          path: row.url,
          url: row.url,
        },
      });
      await prisma.productImage.create({
        data: {
          productId: product.id,
          mediaId: media.id,
          sortOrder: i,
          alt: row.alt,
        },
      });
    }
  }

  console.log('Seeded catalog: Selfieface brand, categories, sample products (en/ar/fr + USD/TND/AED)');
  console.log('Seeded product imagery (Unsplash URLs)');

  const lotionForRails = await prisma.product.findUnique({
    where: { marketId_slug: { marketId: otherMarket.id, slug: 'hydrating-body-lotion' } },
  });
  const cleanserForRails = await prisma.product.findUnique({
    where: { marketId_slug: { marketId: otherMarket.id, slug: 'gentle-cream-cleanser' } },
  });
  const serumForRails = await prisma.product.findUnique({
    where: { marketId_slug: { marketId: otherMarket.id, slug: 'barrier-repair-serum' } },
  });
  const spfForRails = await prisma.product.findUnique({
    where: { marketId_slug: { marketId: otherMarket.id, slug: 'daily-mineral-spf-30' } },
  });

  if (lotionForRails) {
    await prisma.product.update({
      where: { id: lotionForRails.id },
      data: { popularityScore: 12 },
    });
  }
  if (cleanserForRails) {
    await prisma.product.update({
      where: { id: cleanserForRails.id },
      data: { popularityScore: 8 },
    });
  }
  if (spfForRails) {
    await prisma.product.update({
      where: { id: spfForRails.id },
      data: {
        isIncoming: true,
        incomingAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
  }

  // Leave TOP/NEW empty so auto-rank demos popularity / recency.
  // Pin Incoming rail to SPF so curation is visible in admin.
  if (spfForRails) {
    await prisma.merchandisingRailItem.deleteMany({
      where: { rail: MerchandisingRailKind.INCOMING, marketId: otherMarket.id },
    });
    await prisma.merchandisingRailItem.create({
      data: {
        rail: MerchandisingRailKind.INCOMING,
        productId: spfForRails.id,
        marketId: otherMarket.id,
        sortOrder: 0,
      },
    });
  }

  if (serumForRails) {
    await prisma.searchInsight.upsert({
      where: {
        marketId_query_locale: {
          marketId: otherMarket.id,
          query: 'barrier',
          locale: Locale.en,
        },
      },
      create: {
        query: 'barrier',
        locale: Locale.en,
        marketId: otherMarket.id,
        hitCount: 3,
        lastSeenAt: new Date(),
      },
      update: {
        hitCount: 3,
        lastSeenAt: new Date(),
      },
    });
  }

  console.log('Seeded homepage merchandising (incoming rail + popularity + sample search insight)');

  const reviewerEmail = 'reviewer@lumea.local';
  const reviewerHash = await bcrypt.hash('SelfiefaceReview123!', 12);
  const reviewerUser = await prisma.user.upsert({
    where: { email: reviewerEmail },
    update: {
      passwordHash: reviewerHash,
      type: UserType.CUSTOMER,
      firstName: 'Amina',
      lastName: 'K.',
      emailVerifiedAt: new Date(),
    },
    create: {
      email: reviewerEmail,
      passwordHash: reviewerHash,
      type: UserType.CUSTOMER,
      firstName: 'Amina',
      lastName: 'K.',
      emailVerifiedAt: new Date(),
      customer: { create: {} },
    },
    include: { customer: true },
  });

  const lotion = await prisma.product.findUnique({
    where: { marketId_slug: { marketId: otherMarket.id, slug: 'hydrating-body-lotion' } },
    select: { id: true },
  });
  if (lotion && reviewerUser.customer) {
    await prisma.review.upsert({
      where: {
        productId_customerId: {
          productId: lotion.id,
          customerId: reviewerUser.customer.id,
        },
      },
      create: {
        productId: lotion.id,
        customerId: reviewerUser.customer.id,
        rating: 5,
        title: 'Daily essential',
        body: 'Absorbs quickly and keeps my skin soft through the day without any sticky feel.',
        status: ReviewStatus.APPROVED,
      },
      update: {
        rating: 5,
        title: 'Daily essential',
        body: 'Absorbs quickly and keeps my skin soft through the day without any sticky feel.',
        status: ReviewStatus.APPROVED,
      },
    });
    console.log(`Seeded approved review on hydrating-body-lotion (${reviewerEmail})`);
  }

  // Sample orders for analytics dashboard (idempotent by order number)
  if (reviewerUser.customer) {
    const lotionVariant = await prisma.productVariant.findFirst({
      where: { sku: 'LUM-HBL-250' },
      include: { product: true, prices: true },
    });
    const cleanserVariant = await prisma.productVariant.findFirst({
      where: { sku: 'LUM-GCC-150' },
      include: { product: true, prices: true },
    });
    const serumVariant = await prisma.productVariant.findFirst({
      where: { sku: 'LUM-BRS-30' },
      include: { product: true, prices: true },
    });

    const priceFor = (
      variant: { prices: { currency: Currency; amount: number }[] } | null,
      currency: Currency,
    ) => variant?.prices.find((p) => p.currency === currency)?.amount ?? 0;

    type SeedOrder = {
      number: string;
      daysAgo: number;
      currency: Currency;
      status: OrderStatus;
      paymentStatus: PaymentStatus;
      shippingAmount: number;
      taxAmount: number;
      lines: { variant: NonNullable<typeof lotionVariant>; qty: number }[];
    };

    const seedOrders: SeedOrder[] = [];
    if (lotionVariant) {
      seedOrders.push({
        number: 'LM-SEED-USD-001',
        daysAgo: 2,
        currency: Currency.USD,
        status: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.CAPTURED,
        shippingAmount: 0,
        taxAmount: 0,
        lines: [{ variant: lotionVariant, qty: 2 }],
      });
      seedOrders.push({
        number: 'LM-SEED-USD-002',
        daysAgo: 5,
        currency: Currency.USD,
        status: OrderStatus.PROCESSING,
        paymentStatus: PaymentStatus.CAPTURED,
        shippingAmount: 800,
        taxAmount: 0,
        lines: [
          { variant: lotionVariant, qty: 1 },
          ...(cleanserVariant ? [{ variant: cleanserVariant, qty: 1 }] : []),
        ],
      });
    }
    if (serumVariant) {
      seedOrders.push({
        number: 'LM-SEED-TND-001',
        daysAgo: 3,
        currency: Currency.TND,
        status: OrderStatus.SHIPPED,
        paymentStatus: PaymentStatus.CAPTURED,
        shippingAmount: 0,
        taxAmount: 0,
        lines: [{ variant: serumVariant, qty: 1 }],
      });
    }
    if (cleanserVariant) {
      seedOrders.push({
        number: 'LM-SEED-AED-001',
        daysAgo: 8,
        currency: Currency.AED,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.CAPTURED,
        shippingAmount: 1500,
        taxAmount: 0,
        lines: [{ variant: cleanserVariant, qty: 2 }],
      });
      seedOrders.push({
        number: 'LM-SEED-USD-CXL',
        daysAgo: 4,
        currency: Currency.USD,
        status: OrderStatus.CANCELLED,
        paymentStatus: PaymentStatus.REFUNDED,
        shippingAmount: 800,
        taxAmount: 0,
        lines: [{ variant: cleanserVariant, qty: 1 }],
      });
    }

    for (const spec of seedOrders) {
      const existing = await prisma.order.findUnique({ where: { number: spec.number } });
      if (existing) continue;

      const lineData = spec.lines.map((line) => {
        const unitPrice = priceFor(line.variant, spec.currency);
        return {
          variantId: line.variant.id,
          productName: line.variant.product.name,
          variantName: line.variant.name,
          sku: line.variant.sku,
          unitPrice,
          quantity: line.qty,
          lineTotal: unitPrice * line.qty,
        };
      });
      const subtotal = lineData.reduce((sum, l) => sum + l.lineTotal, 0);
      const total = subtotal + spec.shippingAmount + spec.taxAmount;
      const createdAt = new Date();
      createdAt.setUTCDate(createdAt.getUTCDate() - spec.daysAgo);
      createdAt.setUTCHours(14, 0, 0, 0);

      await prisma.order.create({
        data: {
          number: spec.number,
          customerId: reviewerUser.customer.id,
          status: spec.status,
          paymentStatus: spec.paymentStatus,
          currency: spec.currency,
          locale: Locale.en,
          marketId:
            spec.currency === Currency.AED
              ? allMarkets.find((m) => m.code === 'AE')!.id
              : spec.currency === Currency.TND
                ? allMarkets.find((m) => m.code === 'TN')!.id
                : otherMarket.id,
          subtotal,
          discount: 0,
          shippingAmount: spec.shippingAmount,
          taxAmount: spec.taxAmount,
          total,
          shippingZone: ShippingZone.DOMESTIC,
          shippingFullName: 'Amina K.',
          shippingLine1: '12 Rue des Jardins',
          shippingCity: 'Tunis',
          shippingPostalCode: '1002',
          shippingCountry: 'TN',
          createdAt,
          items: { create: lineData },
          timelineEvents: {
            create: [
              {
                status: OrderStatus.PENDING,
                note: 'Order placed',
                actorType: OrderTimelineActorType.SYSTEM,
                createdAt,
              },
              ...(spec.status !== OrderStatus.PENDING
                ? [
                    {
                      status: spec.status,
                      note: `Seeded as ${spec.status}`,
                      actorType: OrderTimelineActorType.SYSTEM,
                      createdAt,
                    },
                  ]
                : []),
            ],
          },
        },
      });
    }

    if (seedOrders.length) {
      console.log(`Seeded sample orders for analytics (${seedOrders.map((o) => o.number).join(', ')})`);
    }
  }

  // Coupons + sample wishlist (one set per market window, market currency amounts)
  const couponSpecs: Array<{
    code: string;
    type: typeof CouponType.PERCENT | typeof CouponType.FIXED;
    percentOff: number | null;
    amountOffByCurrency?: { USD: number; TND: number; AED: number };
    minSubtotalByCurrency?: { USD: number; TND: number; AED: number };
    description: string;
    maxUses: number | null;
    maxUsesPerCustomer: number | null;
  }> = [
    {
      code: 'WELCOME10',
      type: CouponType.PERCENT,
      percentOff: 10,
      minSubtotalByCurrency: { USD: 2500, TND: 7500, AED: 9000 },
      description: '10% off your first order',
      maxUses: 1000,
      maxUsesPerCustomer: 1,
    },
    {
      code: 'LUMEA5',
      type: CouponType.FIXED,
      percentOff: null,
      amountOffByCurrency: { USD: 500, TND: 1500, AED: 1800 },
      description: 'Fixed amount off your bag',
      maxUses: null,
      maxUsesPerCustomer: null,
    },
  ];

  for (const market of allMarkets) {
    const currency = market.currency as 'USD' | 'TND' | 'AED';
    for (const spec of couponSpecs) {
      const amountOff =
        spec.type === CouponType.FIXED
          ? (spec.amountOffByCurrency?.[currency] ?? null)
          : null;
      const minSubtotal =
        spec.type === CouponType.PERCENT
          ? (spec.minSubtotalByCurrency?.[currency] ?? null)
          : null;
      await prisma.coupon.upsert({
        where: { marketId_code: { marketId: market.id, code: spec.code } },
        update: {
          type: spec.type,
          description: spec.description,
          percentOff: spec.percentOff,
          amountOff,
          minSubtotal,
          maxUses: spec.maxUses,
          maxUsesPerCustomer: spec.maxUsesPerCustomer,
          isActive: true,
          startsAt: null,
          endsAt: null,
        },
        create: {
          code: spec.code,
          marketId: market.id,
          type: spec.type,
          description: spec.description,
          percentOff: spec.percentOff,
          amountOff,
          minSubtotal,
          maxUses: spec.maxUses,
          maxUsesPerCustomer: spec.maxUsesPerCustomer,
          isActive: true,
        },
      });
    }
  }
  console.log('Seeded coupons per market: WELCOME10 (10% off), LUMEA5 (fixed)');

  const promoProducts = await prisma.product.findMany({
    where: {
      marketId: otherMarket.id,
      slug: { in: ['hydrating-body-lotion', 'gentle-cream-cleanser'] },
    },
    select: { id: true },
  });
  if (promoProducts.length) {
    const campaign = await prisma.promotion.upsert({
      where: { marketId_slug: { marketId: otherMarket.id, slug: 'soft-start' } },
      update: {
        name: 'Soft start',
        tag: 'Promotion',
        description: 'Introductory campaign badges on hero body & cleanser SKUs.',
        isActive: true,
        startsAt: null,
        endsAt: null,
      },
      create: {
        name: 'Soft start',
        slug: 'soft-start',
        tag: 'Promotion',
        description: 'Introductory campaign badges on hero body & cleanser SKUs.',
        isActive: true,
        marketId: otherMarket.id,
      },
    });
    await prisma.promotionProduct.deleteMany({ where: { promotionId: campaign.id } });
    await prisma.promotionProduct.createMany({
      data: promoProducts.map((p) => ({
        promotionId: campaign.id,
        productId: p.id,
      })),
      skipDuplicates: true,
    });
    console.log('Seeded promotion campaign: Soft start');
  }

  if (reviewerUser.customer && lotion) {
    await prisma.wishlistItem.upsert({
      where: {
        customerId_productId: {
          customerId: reviewerUser.customer.id,
          productId: lotion.id,
        },
      },
      create: {
        customerId: reviewerUser.customer.id,
        productId: lotion.id,
      },
      update: {},
    });
    const serum = await prisma.product.findUnique({
      where: { marketId_slug: { marketId: otherMarket.id, slug: 'barrier-repair-serum' } },
      select: { id: true },
    });
    if (serum) {
      await prisma.wishlistItem.upsert({
        where: {
          customerId_productId: {
            customerId: reviewerUser.customer.id,
            productId: serum.id,
          },
        },
        create: {
          customerId: reviewerUser.customer.id,
          productId: serum.id,
        },
        update: {},
      });
    }
    console.log(`Seeded wishlist items for ${reviewerEmail}`);
  }

  // Home hero carousel + secondary promo banners (admin-editable)
  const heroBannerSeed = [
    {
      key: 'hero-ritual',
      sortOrder: 0,
      href: '/shop',
      url: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1600&q=80',
      translations: [
        { locale: Locale.en, title: 'Rituals that glow', subtitle: 'New season', ctaLabel: 'Shop the edit' },
        { locale: Locale.ar, title: 'طقوس تتألق', subtitle: 'موسم جديد', ctaLabel: 'تسوّقي المجموعة' },
        { locale: Locale.fr, title: 'Des rituels lumineux', subtitle: 'Nouvelle saison', ctaLabel: 'Voir la sélection' },
      ],
    },
    {
      key: 'hero-spf',
      sortOrder: 1,
      href: '/shop?incoming=1',
      url: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&w=1600&q=80',
      translations: [
        { locale: Locale.en, title: 'Incoming SPF care', subtitle: 'Coming soon', ctaLabel: 'See incoming' },
        { locale: Locale.ar, title: 'عناية SPF قادمة', subtitle: 'قريباً', ctaLabel: 'شاهدي القادم' },
        { locale: Locale.fr, title: 'Soin SPF à venir', subtitle: 'Bientôt', ctaLabel: 'Voir les arrivages' },
      ],
    },
    {
      key: 'hero-promo',
      sortOrder: 2,
      href: '/shop?promotion=1',
      url: 'https://images.unsplash.com/photo-1571781926291-c77df46a9a55?auto=format&fit=crop&w=1600&q=80',
      translations: [
        { locale: Locale.en, title: 'Soft start offers', subtitle: 'Promotions', ctaLabel: 'Shop promotions' },
        { locale: Locale.ar, title: 'عروض البداية الناعمة', subtitle: 'تخفيضات', ctaLabel: 'تسوّقي العروض' },
        { locale: Locale.fr, title: 'Offres Soft start', subtitle: 'Promotions', ctaLabel: 'Voir les promos' },
      ],
    },
  ] as const;

  const secondaryBannerSeed = [
    {
      key: 'sec-body',
      sortOrder: 0,
      href: '/shop?category=body',
      url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=1200&q=80',
      translations: [
        { locale: Locale.en, title: 'Body care', subtitle: 'Daily soften', ctaLabel: 'Explore' },
        { locale: Locale.ar, title: 'عناية الجسم', subtitle: 'نعومة يومية', ctaLabel: 'استكشفي' },
        { locale: Locale.fr, title: 'Soin du corps', subtitle: 'Douceur quotidienne', ctaLabel: 'Explorer' },
      ],
    },
    {
      key: 'sec-journal',
      sortOrder: 1,
      href: '/journal',
      url: 'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?auto=format&fit=crop&w=1200&q=80',
      translations: [
        { locale: Locale.en, title: 'Journal notes', subtitle: 'Editorial', ctaLabel: 'Read' },
        { locale: Locale.ar, title: 'ملاحظات المجلة', subtitle: 'افتتاحي', ctaLabel: 'اقرأ' },
        { locale: Locale.fr, title: 'Notes du journal', subtitle: 'Édito', ctaLabel: 'Lire' },
      ],
    },
    {
      key: 'sec-wishlist',
      sortOrder: 2,
      href: '/shop?recommended=1',
      url: 'https://images.unsplash.com/photo-1620916297397-a4a3322f5eca?auto=format&fit=crop&w=1200&q=80',
      translations: [
        { locale: Locale.en, title: 'Recommended for you', subtitle: 'Curated', ctaLabel: 'Browse' },
        { locale: Locale.ar, title: 'موصى به لك', subtitle: 'مختار', ctaLabel: 'تصفّحي' },
        { locale: Locale.fr, title: 'Recommandé pour vous', subtitle: 'Sélection', ctaLabel: 'Parcourir' },
      ],
    },
  ] as const;

  async function seedBannerSet(
    placement: PromoBannerPlacement,
    rows: typeof heroBannerSeed | typeof secondaryBannerSeed,
  ) {
    const existing = await prisma.promoBanner.findMany({
      where: { placement },
      include: { translations: true, imageMedia: true },
    });
    if (existing.length >= rows.length) {
      return;
    }
    for (const row of existing) {
      await prisma.promoBanner.delete({ where: { id: row.id } });
      if (row.imageMediaId) {
        await prisma.media.delete({ where: { id: row.imageMediaId } }).catch(() => undefined);
      }
    }
    for (const spec of rows) {
      const media = await prisma.media.create({
        data: {
          filename: `${spec.key}.jpg`,
          mimeType: 'image/jpeg',
          size: 0,
          path: spec.url,
          url: spec.url,
        },
      });
      await prisma.promoBanner.create({
        data: {
          placement,
          isActive: true,
          sortOrder: spec.sortOrder,
          href: spec.href,
          imageMediaId: media.id,
          marketId: otherMarket.id,
          translations: {
            create: spec.translations.map((tr) => ({
              locale: tr.locale,
              title: tr.title,
              subtitle: tr.subtitle,
              ctaLabel: tr.ctaLabel,
            })),
          },
        },
      });
    }
  }

  await seedBannerSet(PromoBannerPlacement.HOME_HERO, heroBannerSeed);
  await seedBannerSet(PromoBannerPlacement.HOME_SECONDARY, secondaryBannerSeed);
  console.log('Seeded home hero carousel + secondary banners');

  const { seedDemoCatalog } = await import('./fixtures/demo-catalog');
  await seedDemoCatalog(prisma);

  if (process.env.SEED_SKIP_FULL_CATALOG === '1') {
    console.log('Skipping full catalog (SEED_SKIP_FULL_CATALOG=1)');
  } else {
    const { seedFullCatalog } = await import('./fixtures/full-catalog');
    await seedFullCatalog(prisma);
  }

  await seedWarehouses();

  const { cloneOtherCatalogToSiblingMarkets } = await import(
    './fixtures/clone-catalog-markets'
  );
  await cloneOtherCatalogToSiblingMarkets(prisma);
}

async function seedWarehouses() {
  const markets = await prisma.market.findMany({ orderBy: { code: 'asc' } });
  const other = markets.find((m) => m.code === 'OTHER') ?? markets[0];
  if (!other) throw new Error('No markets seeded');

  const warehouseIdsByMarket = new Map<string, { mainId: string; outletId: string }>();

  for (const market of markets) {
    const main = await prisma.warehouse.upsert({
      where: { marketId_code: { marketId: market.id, code: 'main' } },
      create: {
        id: market.code === 'OTHER' ? 'wh_main_default' : `wh_main_${market.code.toLowerCase()}`,
        name: 'Main warehouse',
        code: 'main',
        city: 'Tunis',
        country: 'TN',
        isActive: true,
        isDefault: true,
        marketId: market.id,
      },
      update: {
        name: 'Main warehouse',
        isActive: true,
        isDefault: true,
      },
    });

    const secondary = await prisma.warehouse.upsert({
      where: { marketId_code: { marketId: market.id, code: 'outlet' } },
      create: {
        name: 'Outlet warehouse',
        code: 'outlet',
        city: 'Sfax',
        country: 'TN',
        isActive: true,
        isDefault: false,
        marketId: market.id,
      },
      update: {
        name: 'Outlet warehouse',
        isActive: true,
      },
    });

    await prisma.warehouse.updateMany({
      where: { marketId: market.id, id: { not: main.id } },
      data: { isDefault: false },
    });
    await prisma.warehouse.update({
      where: { id: main.id },
      data: { isDefault: true },
    });

    warehouseIdsByMarket.set(market.id, { mainId: main.id, outletId: secondary.id });
  }

  const otherWh = warehouseIdsByMarket.get(other.id)!;
  const variants = await prisma.productVariant.findMany({
    where: { product: { marketId: other.id } },
    select: { id: true, stock: true },
  });

  for (const v of variants) {
    const existing = await prisma.warehouseStock.findMany({
      where: { variantId: v.id },
    });
    if (existing.length === 0) {
      const outletQty = v.stock > 1 ? Math.floor(v.stock * 0.2) : 0;
      const mainQty = v.stock - outletQty;
      await prisma.warehouseStock.create({
        data: { warehouseId: otherWh.mainId, variantId: v.id, quantity: mainQty },
      });
      await prisma.warehouseStock.create({
        data: { warehouseId: otherWh.outletId, variantId: v.id, quantity: outletQty },
      });
    } else {
      await prisma.warehouseStock.upsert({
        where: {
          warehouseId_variantId: { warehouseId: otherWh.mainId, variantId: v.id },
        },
        create: { warehouseId: otherWh.mainId, variantId: v.id, quantity: v.stock },
        update: {},
      });
      await prisma.warehouseStock.upsert({
        where: {
          warehouseId_variantId: { warehouseId: otherWh.outletId, variantId: v.id },
        },
        create: { warehouseId: otherWh.outletId, variantId: v.id, quantity: 0 },
        update: {},
      });
    }

    const activeSum = await prisma.warehouseStock.aggregate({
      where: { variantId: v.id, warehouse: { isActive: true, marketId: other.id } },
      _sum: { quantity: true },
    });
    await prisma.productVariant.update({
      where: { id: v.id },
      data: { stock: activeSum._sum.quantity ?? 0 },
    });
  }

  console.log(
    `Seeded warehouses per market (main + outlet); synced WarehouseStock for ${variants.length} OTHER variants`,
  );
}


main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
