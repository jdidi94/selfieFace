import { setRefreshCookie } from '@/lib/auth-cookies';
import { nestFetch } from '@/lib/nest-api';
import type { AuthSession } from '@lumea/types';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  const res = await nestFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as AuthSession | { message?: string };
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  const session = data as AuthSession;
  const response = NextResponse.json({
    accessToken: session.accessToken,
    user: session.user,
  });
  setRefreshCookie(response, session.refreshToken);
  return response;
}
