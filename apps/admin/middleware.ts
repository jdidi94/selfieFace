import { ADMIN_SESSION_COOKIE, REFRESH_COOKIE } from '@/lib/auth-cookies';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/brand/') ||
    pathname === '/favicon.ico' ||
    pathname === '/icon.png' ||
    pathname === '/apple-icon.png' ||
    /\.(?:png|jpe?g|gif|svg|webp|ico|webmanifest)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  const session = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!session || !refresh) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/).*)'],
};
