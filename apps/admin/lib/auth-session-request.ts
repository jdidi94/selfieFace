// Deduplicate Strict Mode/remount refreshes and serialize cookie rotation across tabs.
let refreshInFlight: Promise<Response> | null = null;
let queue: Promise<unknown> = Promise.resolve();

export function authSessionRequest(path: string, init?: RequestInit): Promise<Response> {
  const refresh = path === '/api/auth/refresh';
  if (refresh && refreshInFlight) return refreshInFlight.then(response => response.clone());
  const run = () => fetch(path, { ...init, cache: 'no-store' });
  const request = queue.catch(() => {}).then(() =>
    typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request('auth-session-cookie', run)
      : run(),
  );
  queue = request;
  if (refresh) {
    refreshInFlight = request;
    void request.finally(() => {
      if (refreshInFlight === request) refreshInFlight = null;
    }).catch(() => {});
  }
  return request.then(response => response.clone());
}
