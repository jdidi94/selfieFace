import type { NextResponse } from 'next/server';

// Storefront and admin apps can share a hostname in development. Keep their
// rotating refresh sessions in separate cookies so one app cannot replace the
// other app's identity.
export const REFRESH_COOKIE = 'selfieface_customer_refresh';
const MAX_AGE = 60 * 60 * 24 * 7;

export function setRefreshCookie(response: NextResponse, refreshToken: string) {
  response.cookies.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export function clearRefreshCookie(response: NextResponse) {
  response.cookies.set(REFRESH_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
