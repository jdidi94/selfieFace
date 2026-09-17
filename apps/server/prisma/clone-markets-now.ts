/**
 * One-off: clone OTHER catalog into AE + TN without running the full seed.
 *   pnpm exec ts-node --transpile-only prisma/clone-markets-now.ts
 */
import { PrismaClient } from '@prisma/client';
import { cloneOtherCatalogToSiblingMarkets } from './fixtures/clone-catalog-markets';

const baseUrl = process.env.DATABASE_URL ?? '';
const sep = baseUrl.includes('?') ? '&' : '?';
const url = baseUrl
  ? `${baseUrl}${sep}connection_limit=5&pool_timeout=60`
  : undefined;

const prisma = new PrismaClient(
  url ? { datasources: { db: { url } } } : undefined,
);

cloneOtherCatalogToSiblingMarkets(prisma)
  .then(async () => {
    const rows = await prisma.market.findMany({
      select: {
        code: true,
        _count: { select: { products: true } },
      },
      orderBy: { code: 'asc' },
    });
    for (const r of rows) {
      console.log(`${r.code}: ${r._count.products} products`);
    }
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
