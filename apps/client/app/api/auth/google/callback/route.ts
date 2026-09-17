import { setRefreshCookie } from '@/lib/auth-cookies';
import { nestFetch } from '@/lib/nest-api';
import type { AuthSession } from '@lumea/types';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const origin = url.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/account/login?error=google`);
  }

  const res = await nestFetch('/auth/google/exchange', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });

  if (!res.ok) {
    return NextResponse.redirect(`${origin}/account/login?error=google`);
  }

  const session = (await res.json()) as AuthSession;
  const response = NextResponse.redirect(`${origin}/`);
  setRefreshCookie(response, session.refreshToken);
  return response;
}
