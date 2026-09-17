import {
  Currency,
  ProductKind,
  type Market,
  type PrismaClient,
} from '@prisma/client';

const FX_FROM_USD: Record<string, number> = {
  USD: 1,
  TND: 3.1,
  AED: 3.67,
};

async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (code !== 'P2024' || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw last;
}

function skuForMarket(baseSku: string, marketCode: string): string {
  const suffix = `-${marketCode}`;
  if (baseSku.endsWith(suffix)) return baseSku;
  // Strip prior market suffixes if re-cloning from a clone
  const stripped = baseSku.replace(/-(AE|TN|OTHER)$/, '');
  return `${stripped}${suffix}`;
}

function amountForCurrency(
  prices: { currency: Currency; amount: number; compareAtAmount: number | null }[],
  currency: Currency,
): { amount: number; compareAtAmount: number | null } {
  const hit = prices.find((p) => p.currency === currency);
  if (hit) return { amount: hit.amount, compareAtAmount: hit.compareAtAmount };

  const usd = prices.find((p) => p.currency === Currency.USD);
  if (usd) {
    const rate = FX_FROM_USD[currency] ?? 1;
    return {
      amount: Math.round(usd.amount * rate),
      compareAtAmount:
        usd.compareAtAmount != null ? Math.round(usd.compareAtAmount * rate) : null,
    };
  }

  const any = prices[0];
  return { amount: any?.amount ?? 0, compareAtAmount: any?.compareAtAmount ?? null };
}

/**
 * Copies the OTHER-market catalog (brands, categories, products, packs, stock)
 * into AE and TN so those windows show the same assortment.
 * Idempotent by `marketId + slug` / SKU suffix.
 */
export async function cloneOtherCatalogToSiblingMarkets(prisma: PrismaClient) {
  const other = await prisma.market.findUniqueOrThrow({ where: { code: 'OTHER' } });
  const targets = await prisma.market.findMany({
    where: { code: { in: ['AE', 'TN'] } },
    orderBy: { code: 'asc' },
  });
  if (!targets.length) {
    console.warn('cloneOtherCatalogToSiblingMarkets: AE/TN markets missing');
    return;
  }

  for (const target of targets) {
    await cloneCatalogToMarket(prisma, other, target);
  }
}

async function ensureWarehouses(prisma: PrismaClient, market: Market) {
  const main = await prisma.warehouse.upsert({
    where: { marketId_code: { marketId: market.id, code: 'main' } },
    create: {
      id: `wh_main_${market.code.toLowerCase()}`,
      name: 'Main warehouse',
      code: 'main',
      city: market.code === 'AE' ? 'Dubai' : 'Tunis',
      country: market.code === 'AE' ? 'AE' : 'TN',
      isActive: true,
      isDefault: true,
      marketId: market.id,
    },
    update: { isActive: true, isDefault: true },
  });
  await prisma.warehouse.updateMany({
    where: { marketId: market.id, id: { not: main.id } },
    data: { isDefault: false },
  });
  return main;
}

async function cloneCatalogToMarket(
  prisma: PrismaClient,
  sourceMarket: Market,
  targetMarket: Market,
) {
  console.log(
    `Cloning catalog ${sourceMarket.code} → ${targetMarket.code} (same products, ${targetMarket.currency} prices)…`,
  );

  const brandMap = new Map<string, string>(); // sourceBrandId → targetBrandId
  const categoryMap = new Map<string, string>();
  const productMap = new Map<string, string>(); // sourceProductId → targetProductId
  const variantMap = new Map<string, string>(); // sourceVariantId → targetVariantId

  const sourceBrands = await prisma.brand.findMany({
    where: { marketId: sourceMarket.id },
    include: { translations: true },
  });
  for (const b of sourceBrands) {
    const target = await withRetry(() =>
      prisma.brand.upsert({
        where: { marketId_slug: { marketId: targetMarket.id, slug: b.slug } },
        create: {
          name: b.name,
          slug: b.slug,
          description: b.description,
          imageUrl: b.imageUrl,
          marketId: targetMarket.id,
        },
        update: {
          name: b.name,
          description: b.description,
          imageUrl: b.imageUrl,
        },
      }),
    );
    brandMap.set(b.id, target.id);
    for (const t of b.translations) {
      await withRetry(() =>
        prisma.brandTranslation.upsert({
          where: { brandId_locale: { brandId: target.id, locale: t.locale } },
          create: {
            brandId: target.id,
            locale: t.locale,
            name: t.name,
            description: t.description,
          },
          update: { name: t.name, description: t.description },
        }),
      );
    }
  }

  const sourceCategories = await prisma.category.findMany({
    where: { marketId: sourceMarket.id },
    include: { translations: true },
  });
  for (const c of sourceCategories) {
    const target = await withRetry(() =>
      prisma.category.upsert({
        where: { marketId_slug: { marketId: targetMarket.id, slug: c.slug } },
        create: {
          name: c.name,
          slug: c.slug,
          description: c.description,
          sortOrder: c.sortOrder,
          marketId: targetMarket.id,
        },
        update: {
          name: c.name,
          description: c.description,
          sortOrder: c.sortOrder,
        },
      }),
    );
    categoryMap.set(c.id, target.id);
    for (const t of c.translations) {
      await withRetry(() =>
        prisma.categoryTranslation.upsert({
          where: { categoryId_locale: { categoryId: target.id, locale: t.locale } },
          create: {
            categoryId: target.id,
            locale: t.locale,
            name: t.name,
            description: t.description,
          },
          update: { name: t.name, description: t.description },
        }),
      );
    }
  }

  const mainWh = await ensureWarehouses(prisma, targetMarket);

  const sourceProducts = await prisma.product.findMany({
    where: { marketId: sourceMarket.id },
    include: {
      translations: true,
      images: true,
      variants: { include: { prices: true } },
      packComponents: true,
    },
    orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }],
  });

  // Pass 1: non-packs so pack components can resolve variant maps
  const regular = sourceProducts.filter((p) => p.kind !== ProductKind.PACK);
  const packs = sourceProducts.filter((p) => p.kind === ProductKind.PACK);

  for (const [index, p] of regular.entries()) {
    if (index === 0 || (index + 1) % 40 === 0 || index + 1 === regular.length) {
      console.log(`  ${targetMarket.code} products ${index + 1}/${regular.length}…`);
    }
    await cloneOneProduct(prisma, p, targetMarket, brandMap, categoryMap, productMap, variantMap, mainWh.id);
  }

  for (const [index, p] of packs.entries()) {
    if (index === 0 || (index + 1) % 20 === 0 || index + 1 === packs.length) {
      console.log(`  ${targetMarket.code} packs ${index + 1}/${packs.length}…`);
    }
    await cloneOneProduct(prisma, p, targetMarket, brandMap, categoryMap, productMap, variantMap, mainWh.id);
  }

  console.log(
    `Done ${targetMarket.code}: ${productMap.size} products mapped (${regular.length} products + ${packs.length} packs from source)`,
  );
}

async function cloneOneProduct(
  prisma: PrismaClient,
  p: {
    id: string;
    name: string;
    slug: string;
    status: import('@prisma/client').ProductStatus;
    kind: ProductKind;
    shortDescription: string | null;
    description: string | null;
    benefits: string | null;
    howToUse: string | null;
    suitableFor: string | null;
    categoryId: string;
    brandId: string;
    popularityScore: number;
    isIncoming: boolean;
    incomingAt: Date | null;
    tags: string[];
    translations: {
      locale: import('@prisma/client').Locale;
      name: string;
      shortDescription: string | null;
      description: string | null;
      benefits: string | null;
      howToUse: string | null;
      suitableFor: string | null;
    }[];
    images: { mediaId: string; sortOrder: number; alt: string | null }[];
    variants: {
      id: string;
      name: string;
      sku: string;
      stock: number;
      weightGrams: number | null;
      barcode: string | null;
      isActive: boolean;
      prices: {
        currency: Currency;
        amount: number;
        compareAtAmount: number | null;
      }[];
    }[];
    packComponents: {
      variantId: string;
      quantity: number;
      sortOrder: number;
    }[];
  },
  targetMarket: Market,
  brandMap: Map<string, string>,
  categoryMap: Map<string, string>,
  productMap: Map<string, string>,
  variantMap: Map<string, string>,
  warehouseId: string,
) {
  const brandId = brandMap.get(p.brandId);
  const categoryId = categoryMap.get(p.categoryId);
  if (!brandId || !categoryId) {
    console.warn(`Skip ${p.slug}: missing brand/category map`);
    return;
  }

  const existing = await prisma.product.findUnique({
    where: { marketId_slug: { marketId: targetMarket.id, slug: p.slug } },
    include: { variants: true },
  });

  if (existing) {
    productMap.set(p.id, existing.id);
    // Map variants by name when already cloned
    for (const sv of p.variants) {
      const tv = existing.variants.find((v) => v.name === sv.name);
      if (tv) variantMap.set(sv.id, tv.id);
    }
    return;
  }

  const created = await withRetry(() =>
    prisma.product.create({
      data: {
        name: p.name,
        slug: p.slug,
        status: p.status,
        kind: p.kind,
        shortDescription: p.shortDescription,
        description: p.description,
        benefits: p.benefits,
        howToUse: p.howToUse,
        suitableFor: p.suitableFor,
        categoryId,
        brandId,
        marketId: targetMarket.id,
        popularityScore: p.popularityScore,
        isIncoming: p.isIncoming,
        incomingAt: p.incomingAt,
        tags: p.tags,
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
        images: {
          create: p.images.map((img) => ({
            mediaId: img.mediaId,
            sortOrder: img.sortOrder,
            alt: img.alt,
          })),
        },
        variants: {
          create: p.variants.map((v) => {
            const money = amountForCurrency(v.prices, targetMarket.currency);
            return {
              name: v.name,
              sku: skuForMarket(v.sku, targetMarket.code),
              stock: v.stock,
              weightGrams: v.weightGrams,
              barcode: v.barcode,
              isActive: v.isActive,
              prices: {
                create: [
                  {
                    currency: targetMarket.currency,
                    amount: money.amount,
                    compareAtAmount: money.compareAtAmount,
                  },
                ],
              },
            };
          }),
        },
      },
      include: { variants: true },
    }),
  );

  productMap.set(p.id, created.id);

  for (const sv of p.variants) {
    const tv = created.variants.find((v) => v.name === sv.name);
    if (tv) {
      variantMap.set(sv.id, tv.id);
      await prisma.warehouseStock.upsert({
        where: {
          warehouseId_variantId: { warehouseId, variantId: tv.id },
        },
        create: { warehouseId, variantId: tv.id, quantity: sv.stock },
        update: { quantity: sv.stock },
      });
    }
  }

  if (p.kind === ProductKind.PACK && p.packComponents.length) {
    for (const comp of p.packComponents) {
      const mappedVariantId = variantMap.get(comp.variantId);
      if (!mappedVariantId) {
        console.warn(
          `Pack ${p.slug}: component variant ${comp.variantId} not mapped yet — skip component`,
        );
        continue;
      }
      await prisma.packComponent.upsert({
        where: {
          packProductId_variantId: {
            packProductId: created.id,
            variantId: mappedVariantId,
          },
        },
        create: {
          packProductId: created.id,
          variantId: mappedVariantId,
          quantity: comp.quantity,
          sortOrder: comp.sortOrder,
        },
        update: {
          quantity: comp.quantity,
          sortOrder: comp.sortOrder,
        },
      });
    }
  }
}
