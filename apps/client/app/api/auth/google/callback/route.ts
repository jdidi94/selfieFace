import { setRefreshCookie } from '@/lib/auth-cookies';
import { getSafeAuthReturnPath } from '@/lib/auth-return';
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
  const encodedReturnPath = request.headers
    .get('cookie')
    ?.split('; ')
    .find((row) => row.startsWith('lumea_auth_return_to='))
    ?.split('=')
    .slice(1)
    .join('=');
  let candidateReturnPath: string | undefined;
  try {
    candidateReturnPath = encodedReturnPath ? decodeURIComponent(encodedReturnPath) : undefined;
  } catch {
    candidateReturnPath = undefined;
  }
  const returnPath = getSafeAuthReturnPath(candidateReturnPath);
  const response = NextResponse.redirect(`${origin}${returnPath}`);
  setRefreshCookie(response, session.refreshToken);
  response.cookies.set('lumea_auth_return_to', '', { path: '/', maxAge: 0 });
  return response;
}
