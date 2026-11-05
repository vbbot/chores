'use client';

import { useQuery, type QueryKey } from '@tanstack/react-query';
import { apiFetch } from './api';

export function useApiQuery<T>(
  queryKey: QueryKey,
  endpoint: string,
  options?: { enabled?: boolean; refetchInterval?: number }
) {
  return useQuery({
    queryKey,
    queryFn: () => apiFetch<T>(endpoint),
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval,
  });
}
