import { parseApiErrorBody, ApiRequestError, resolveMediaUrl } from '@lumea/utils';

export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

/** Public media origin (CDN). Falls back unset → serve via API host. */
export const mediaBaseUrl =
  process.env.NEXT_PUBLIC_MEDIA_URL?.trim() ||
  process.env.NEXT_PUBLIC_MEDIA_CDN_URL?.trim() ||
  null;

export function mediaUrl(pathOrUrl: string | null | undefined) {
  return resolveMediaUrl(pathOrUrl, { apiUrl, mediaBaseUrl });
}

/** 5 minutes — static catalog / content APIs & ISR pages. */
export const STATIC_REVALIDATE_SECONDS = 300;

const CATALOG_PREFIXES = [
  '/products',
  '/categories',
  '/brands',
  '/merchandising',
  '/content/banners',
  '/journal',
  '/store/contact',
  '/store/coupons',
];

function cacheOptions(path: string): RequestInit['next'] {
  const pathname = path.split('?')[0] ?? path;
  const isCatalog = CATALOG_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!isCatalog) {
    return { revalidate: 0 };
  }

  const tags = new Set<string>(['catalog']);
  if (pathname.startsWith('/merchandising') || pathname.startsWith('/content/banners')) {
    tags.add('homepage');
  }
  if (pathname.startsWith('/categories')) {
    tags.add('categories');
    tags.add('homepage');
  }
  // Full URL (incl. query) is the Next fetch cache key → filters stay separate.
  return {
    revalidate: STATIC_REVALIDATE_SECONDS,
    tags: [...tags],
  };
}

export async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    next: init?.next ?? cacheOptions(path),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiRequestError(parseApiErrorBody(err, res.status));
  }
  return res.json() as Promise<T>;
}

export async function authFetch<T>(
  path: string,
  accessToken: string | null,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiRequestError(parseApiErrorBody(err, res.status));
  }
  return res.json() as Promise<T>;
}
