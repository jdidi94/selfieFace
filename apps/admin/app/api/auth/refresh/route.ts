import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from '@/lib/auth-cookies';
import { nestFetch } from '@/lib/nest-api';
import { UserType, type AuthSession } from '@lumea/types';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (!refreshToken) {
    return NextResponse.json({ message: 'No refresh token' }, { status: 401 });
  }

  const res = await nestFetch('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });

  const data = (await res.json()) as AuthSession | { message?: string };
  if (!res.ok) {
    const response = NextResponse.json(data, { status: res.status });
    clearAuthCookies(response);
    return response;
  }

  const session = data as AuthSession;
  if (session.user.type !== UserType.ADMIN) {
    const response = NextResponse.json({ message: 'Admin access only' }, { status: 403 });
    clearAuthCookies(response);
    return response;
  }

  const response = NextResponse.json({
    accessToken: session.accessToken,
    user: session.user,
  });
  setAuthCookies(response, session.refreshToken);
  return response;
}
