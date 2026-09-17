import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  const header = request.headers.get('x-revalidate-secret');
  if (!secret || header !== secret) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  let tags: string[] = ['catalog', 'homepage', 'categories', 'seo'];
  let paths: string[] = ['/', '/shop', '/search', '/journal'];
  try {
    const body = (await request.json()) as { tags?: string[]; paths?: string[] };
    if (Array.isArray(body.tags) && body.tags.length) tags = body.tags;
    if (Array.isArray(body.paths) && body.paths.length) paths = body.paths;
  } catch {
    // use defaults
  }

  for (const tag of tags) {
    revalidateTag(tag);
  }
  for (const path of paths) {
    revalidatePath(path);
  }

  return NextResponse.json({ revalidated: true, tags, paths, now: Date.now() });
}
