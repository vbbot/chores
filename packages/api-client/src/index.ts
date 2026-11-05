export interface ApiClientOptions {
  /** Empty string means same-origin. */
  baseUrl?: string;
  /** Native clients return a Firebase ID token here. Web uses cookies. */
  getToken?: () => string | null | Promise<string | null>;
  fetchImpl?: typeof fetch;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function resolveApiUrl(path: string, baseUrl = ''): string {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl.replace(/\/$/, '')}${suffix}`;
}

/**
 * Absolute URL for links the user copies elsewhere, such as calendar feeds.
 * With a same-origin deployment the relative path needs the browser origin.
 */
export function resolveAbsoluteApiUrl(
  path: string,
  origin = '',
  baseUrl = ''
): string {
  const url = resolveApiUrl(path, baseUrl);
  if (/^https?:\/\//.test(url)) return url;
  return origin ? `${origin}${url}` : url;
}

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? '';
  const fetchImpl = options.fetchImpl ?? fetch;

  async function request<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers || {});
    if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const token = options.getToken ? await options.getToken() : null;
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const response = await fetchImpl(resolveApiUrl(endpoint, baseUrl), {
      ...init,
      headers,
      credentials: options.getToken ? 'omit' : 'include',
    });

    if (!response.ok) {
      let detail = 'Request failed';
      try {
        const data = await response.json();
        detail = data.detail || detail;
      } catch {
        // Non-JSON error response.
      }
      throw new ApiError(detail, response.status);
    }

    if (response.status === 204) return {} as T;
    return response.json();
  }

  return {
    request,
    get: <T>(endpoint: string) => request<T>(endpoint),
    post: <T>(endpoint: string, body?: unknown) =>
      request<T>(endpoint, {
        method: 'POST',
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    put: <T>(endpoint: string, body?: unknown) =>
      request<T>(endpoint, {
        method: 'PUT',
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
