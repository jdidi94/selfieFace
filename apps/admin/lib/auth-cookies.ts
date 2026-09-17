import type { NextResponse } from 'next/server';

export const REFRESH_COOKIE = 'refreshToken';
export const ADMIN_SESSION_COOKIE = 'admin_session';
const MAX_AGE = 60 * 60 * 24 * 7;

export function setAuthCookies(response: NextResponse, refreshToken: string) {
  response.cookies.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
  response.cookies.set(ADMIN_SESSION_COOKIE, '1', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export function clearAuthCookies(response: NextResponse) {
  for (const name of [REFRESH_COOKIE, ADMIN_SESSION_COOKIE]) {
    response.cookies.set(name, '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }
}
