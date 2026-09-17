export const nestApiUrl = process.env.NEST_API_URL ?? 'http://localhost:4000/api';

export async function nestFetch(path: string, init?: RequestInit) {
  return fetch(`${nestApiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}
