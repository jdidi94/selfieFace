import type { NextResponse } from 'next/server';

export const REFRESH_COOKIE = 'refreshToken';
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
