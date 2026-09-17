/**
 * Resolve a media path or absolute URL for storefront/admin delivery.
 *
 * DB / API values stay as `/api/media/:id`. When `mediaBaseUrl` is set
 * (`NEXT_PUBLIC_MEDIA_URL` or `MEDIA_PUBLIC_BASE_URL`), that origin is used
 * instead of the API host — e.g. a CDN in front of Nest media.
 */
export function resolveMediaUrl(
  pathOrUrl: string | null | undefined,
  options: {
    /** Nest API base including `/api` (e.g. `http://localhost:4000/api`). */
    apiUrl: string;
    /** Optional public media origin (no trailing slash), e.g. `https://cdn.example.com`. */
    mediaBaseUrl?: string | null;
  },
): string | null {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }

  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  const mediaBase = options.mediaBaseUrl?.trim().replace(/\/$/, '') || null;

  if (mediaBase && (path.startsWith('/api/media/') || path === '/api/media')) {
    return `${mediaBase}${path}`;
  }

  const apiOrigin = options.apiUrl.replace(/\/api\/?$/, '');
  return `${apiOrigin}${path}`;
}
