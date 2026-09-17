import { nestFetch } from '@/lib/nest-api';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  const res = await nestFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
