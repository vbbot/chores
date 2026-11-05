const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

/**
 * Absolute URL for an API path. With no configured base the app is served
 * behind the same origin (nginx routes /api to FastAPI).
 */
export function resolveApiUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${suffix}`;
}

/**
 * Absolute URL for links the user copies elsewhere, such as calendar feeds.
 * With a same-origin deployment the relative API path is completed with the
 * browser origin so Google Calendar and Apple Calendar receive a real URL.
 */
export function resolveAbsoluteApiUrl(path: string, origin = ''): string {
  const url = resolveApiUrl(path);
  if (/^https?:\/\//.test(url)) return url;
  return origin ? `${origin}${url}` : url;
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = resolveApiUrl(endpoint);

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    let errorDetail = 'Request failed';
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || errorDetail;
    } catch {
      // Non-json response
    }
    throw new Error(errorDetail);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
