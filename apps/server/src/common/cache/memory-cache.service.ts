import { Injectable, Logger } from '@nestjs/common';

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

@Injectable()
export class MemoryCacheService {
  private readonly logger = new Logger(MemoryCacheService.name);
  private readonly store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async getOrSet<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
    const hit = this.get<T>(key);
    if (hit !== undefined) return hit;
    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }

  /** Delete keys that start with any of the given prefixes. */
  invalidate(...prefixes: string[]): number {
    let removed = 0;
    for (const key of this.store.keys()) {
      if (prefixes.some((p) => key === p || key.startsWith(p))) {
        this.store.delete(key);
        removed += 1;
      }
    }
    if (removed > 0) {
      this.logger.debug(`Invalidated ${removed} cache key(s) for: ${prefixes.join(', ')}`);
    }
    return removed;
  }

  clear(): void {
    this.store.clear();
  }
}
