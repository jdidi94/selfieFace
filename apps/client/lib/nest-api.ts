/**
 * Server-only Nest API base URL for Next.js route handlers (BFF).
 * Prefer NEST_API_URL; fall back to NEXT_PUBLIC_API_URL so production
 * deploys that only set the public URL still proxy login correctly.
 */
export const nestApiUrl = (
  process.env.NEST_API_URL?.trim() ||
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  'http://localhost:4000/api'
).replace(/\/$/, '');

export async function nestFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${nestApiUrl}${path.startsWith('/') ? path : `/${path}`}`;
  try {
    return await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to reach the API';
    return new Response(JSON.stringify({ message: `API unreachable (${nestApiUrl}): ${message}` }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/** Parse Nest/JSON body safely — empty or HTML responses become a message object. */
export async function nestJson<T = unknown>(
  res: Response,
): Promise<T | { message: string }> {
  const text = await res.text();
  if (!text) {
    return {
      message: `Empty response from API (${res.status}). Check NEST_API_URL / NEXT_PUBLIC_API_URL.`,
    };
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return {
      message: `Invalid API response (${res.status}). Check NEST_API_URL points at the Nest server.`,
    };
  }
}
