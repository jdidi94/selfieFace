import { parseApiErrorBody, ApiRequestError, resolveMediaUrl } from '@lumea/utils';

/**
 * Browser + shared admin API base URL.
 * Must be NEXT_PUBLIC_* so it is available in client components.
 * Set this on Render at **build** time (not only runtime) and redeploy.
 * `.env.local` is never used on Render.
 */
export const publicApiUrl = (
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  'http://localhost:4000/api'
).replace(/\/$/, '');

export const apiUrl = publicApiUrl;

/** @deprecated Use publicApiUrl — NEST_API_URL is server-only and is undefined in the browser. */
export const nestApiUrl = publicApiUrl;

/** Abort hung API calls after 40 seconds. */
export const API_TIMEOUT_MS = 40_000;

function withApiTimeout(signal?: AbortSignal | null): AbortSignal {
  const timeout = AbortSignal.timeout(API_TIMEOUT_MS);
  if (!signal) return timeout;
  return typeof AbortSignal.any === 'function'
    ? AbortSignal.any([signal, timeout])
    : timeout;
}

/** Public media origin (CDN). Falls back unset → serve via API host. */
export const mediaBaseUrl =
  process.env.NEXT_PUBLIC_MEDIA_URL?.trim() ||
  process.env.NEXT_PUBLIC_MEDIA_CDN_URL?.trim() ||
  null;

export function mediaUrl(pathOrUrl: string | null | undefined) {
  return resolveMediaUrl(pathOrUrl, { apiUrl: publicApiUrl, mediaBaseUrl });
}

const ADMIN_MARKET_COOKIE = 'admin_market';

function readAdminMarketHeader(): string {
  if (typeof document === 'undefined') return 'OTHER';
  const match = document.cookie.match(new RegExp(`${ADMIN_MARKET_COOKIE}=([^;]+)`));
  const value = match?.[1]?.toUpperCase();
  if (value === 'AE' || value === 'TN' || value === 'OTHER') return value;
  return 'OTHER';
}

type CacheEntry = { expires: number; data: unknown };

/** Short-lived GET cache for admin dashboard navigations.
 * Cache key = full path including query string, so different filters
 * (e.g. ?status=SENT&page=2 vs ?status=FAILED) are cached separately.
 */
const getCache = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 45_000;
const MAX_CACHE_ENTRIES = 120;

function cacheKey(path: string, accessToken: string | null) {
  const market =
    typeof document !== 'undefined'
      ? (document.cookie.match(/admin_market=([^;]+)/)?.[1] ?? 'OTHER')
      : 'OTHER';
  return `${accessToken ? accessToken.slice(-12) : 'anon'}::${market}::${path}`;
}

function pruneCache() {
  if (getCache.size <= MAX_CACHE_ENTRIES) return;
  const now = Date.now();
  for (const [key, entry] of getCache) {
    if (entry.expires <= now) getCache.delete(key);
  }
  while (getCache.size > MAX_CACHE_ENTRIES) {
    const first = getCache.keys().next().value;
    if (first === undefined) break;
    getCache.delete(first);
  }
}

/** Drop cached GETs (all, or those whose path contains `match`). */
export function invalidateAdminCache(match?: string) {
  if (!match) {
    getCache.clear();
    return;
  }
  for (const key of [...getCache.keys()]) {
    if (key.includes(match)) getCache.delete(key);
  }
}

export type AdminFetchInit = RequestInit & {
  /** Bypass short TTL GET cache for this call. */
  skipCache?: boolean;
  /** Override GET cache TTL (ms). */
  cacheTtlMs?: number;
};

export async function adminFetch<T>(
  path: string,
  accessToken: string | null,
  init?: AdminFetchInit,
): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const key = cacheKey(path, accessToken);
  const { skipCache, cacheTtlMs, ...fetchInit } = init ?? {};

  if (method === 'GET' && !skipCache) {
    const hit = getCache.get(key);
    if (hit && hit.expires > Date.now()) {
      return hit.data as T;
    }
  }

  const res = await fetch(`${publicApiUrl}${path}`, {
    ...fetchInit,
    signal: withApiTimeout(fetchInit.signal),
    headers: {
      ...(fetchInit.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      'x-market': readAdminMarketHeader(),
      ...(fetchInit.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiRequestError(parseApiErrorBody(err, res.status));
  }

  if (res.status === 204) {
    if (method !== 'GET') invalidateAdminCache();
    return undefined as T;
  }

  const data = (await res.json()) as T;

  if (method === 'GET' && !skipCache) {
    pruneCache();
    getCache.set(key, {
      data,
      expires: Date.now() + (cacheTtlMs ?? DEFAULT_TTL_MS),
    });
  } else if (method !== 'GET') {
    // Mutations: clear so lists/details refresh on next navigation.
    invalidateAdminCache();
  }

  return data;
}
