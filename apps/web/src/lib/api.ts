import {
  createApiClient,
  resolveAbsoluteApiUrl,
  resolveApiUrl,
} from '@chores/api-client';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

const client = createApiClient({ baseUrl: API_BASE_URL });

export { resolveAbsoluteApiUrl, resolveApiUrl };

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  return client.request<T>(endpoint, options);
}
