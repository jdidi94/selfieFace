import { setRefreshCookie } from '@/lib/auth-cookies';
import { nestFetch, nestJson } from '@/lib/nest-api';
import { UserType, type AuthSession } from '@lumea/types';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  const res = await nestFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  const data = await nestJson<AuthSession>(res);
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  const session = data as AuthSession;
  if (!session.accessToken || !session.user) {
    return NextResponse.json(
      { message: (data as { message?: string }).message ?? 'Login failed' },
      { status: 502 },
    );
  }

  if (session.user.type !== UserType.CUSTOMER) {
    return NextResponse.json(
      { message: 'Customer access only. Use the admin dashboard to sign in as an administrator.' },
      { status: 403 },
    );
  }

  const response = NextResponse.json({
    accessToken: session.accessToken,
    user: session.user,
  });
  setRefreshCookie(response, session.refreshToken);
  return response;
}
