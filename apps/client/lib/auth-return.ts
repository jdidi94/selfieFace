const AUTH_PATH = /^\/(?:[a-z]{2}\/[a-z]{2}\/)?account\/(?:login|register)(?:\/|$)/i;

/** Keep auth redirects on this storefront and avoid routing back to auth itself. */
export function getSafeAuthReturnPath(value: string | null | undefined, fallback = '/') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || AUTH_PATH.test(value)) {
    return fallback;
  }
  return value;
}

export function authPathWithReturn(path: '/account/login' | '/account/register', returnPath: string) {
  return `${path}?next=${encodeURIComponent(getSafeAuthReturnPath(returnPath))}`;
}
