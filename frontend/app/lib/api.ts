/**
 * Phase 20 — API base: empty string uses same-origin (Vite `/api` proxy in dev).
 */
export function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetchJson<T>(
  path: string,
  init: RequestInit & { accessToken?: string | null } = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (init.accessToken) {
    headers.set('Authorization', `Bearer ${init.accessToken}`);
  }
  const { accessToken: _a, ...rest } = init;
  let res = await fetch(apiUrl(path), { ...rest, headers });
  if (res.status === 401 && init.accessToken) {
    // Caller can rehydrate token from session on subsequent calls.
    res = await fetch(apiUrl(path), { ...rest, headers });
  }
  const text = await res.text();
  let body: unknown = undefined;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { raw: text };
    }
  }
  if (!res.ok) {
    const err = body as { error?: string; code?: string };
    throw new ApiError(err?.error ?? res.statusText, res.status, err?.code);
  }
  if (body === undefined || text === '') {
    return undefined as T;
  }
  return body as T;
}
