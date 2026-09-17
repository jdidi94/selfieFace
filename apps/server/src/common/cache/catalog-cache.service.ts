import { Injectable, Logger } from '@nestjs/common';
import { MarketCode } from '@lumea/types';
import { MemoryCacheService } from './memory-cache.service';
import { catalogMarketTag, parseMarketCode } from '../../markets/market.util';

/** Default TTL for public catalog responses (5 minutes). */
export const CATALOG_CACHE_TTL_MS = 300_000;

export const CACHE_PREFIX = {
  productsList: 'products:list:',
  productDetail: 'products:detail:',
  productRelated: 'products:related:',
  rails: 'rails:',
  categories: 'categories:',
  brands: 'brands:',
  banners: 'banners:',
} as const;

@Injectable()
export class CatalogCacheService {
  private readonly logger = new Logger(CatalogCacheService.name);

  constructor(private readonly cache: MemoryCacheService) {}

  /** Namespaced key: catalog:AE:products:list:… */
  key(market: MarketCode | string, prefix: string, suffix: string): string {
    return `${catalogMarketTag(market)}:${prefix}${suffix}`;
  }

  getOrSet<T>(key: string, factory: () => Promise<T>, ttlMs = CATALOG_CACHE_TTL_MS): Promise<T> {
    return this.cache.getOrSet(key, ttlMs, factory);
  }

  /**
   * Bust catalog caches. When `market` is set, only that window is cleared
   * (plus legacy unscoped `catalog:` keys). Always notifies the storefront.
   */
  async invalidateCatalog(market?: MarketCode | string): Promise<void> {
    if (market) {
      const code = parseMarketCode(market);
      this.cache.invalidate(`${catalogMarketTag(code)}:`);
      this.cache.invalidate('catalog:');
    } else {
      this.cache.invalidate('catalog:');
      for (const code of [MarketCode.AE, MarketCode.TN, MarketCode.OTHER]) {
        this.cache.invalidate(`${catalogMarketTag(code)}:`);
      }
    }
    await this.notifyStorefrontRevalidate(market);
  }

  private async notifyStorefrontRevalidate(market?: MarketCode | string): Promise<void> {
    const siteUrl = process.env.CLIENT_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
    const secret = process.env.REVALIDATE_SECRET;
    if (!siteUrl || !secret) {
      this.logger.debug(
        'Skip storefront revalidate (set CLIENT_URL + REVALIDATE_SECRET to enable ISR bust)',
      );
      return;
    }

    const tags = ['catalog', 'homepage', 'categories', 'seo'];
    if (market) {
      tags.push(catalogMarketTag(market));
    } else {
      tags.push('catalog:AE', 'catalog:TN', 'catalog:OTHER');
    }

    const url = `${siteUrl.replace(/\/$/, '')}/api/revalidate`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-revalidate-secret': secret,
        },
        body: JSON.stringify({
          tags,
          paths: ['/', '/shop', '/search', '/journal'],
        }),
      });
      if (!res.ok) {
        this.logger.warn(`Storefront revalidate failed: ${res.status}`);
      } else {
        this.logger.log('Storefront catalog cache revalidated');
      }
    } catch (err) {
      this.logger.warn(
        `Storefront revalidate unreachable: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
