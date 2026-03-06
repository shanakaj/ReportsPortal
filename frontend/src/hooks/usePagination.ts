import { useInfiniteQuery } from '@tanstack/react-query';
import type { PaginatedResponse } from '@/types';

interface UsePaginationOptions<T> {
  queryKey: unknown[];
  queryFn: (cursor?: string) => Promise<PaginatedResponse<T>>;
  enabled?: boolean;
}

export function usePagination<T>({ queryKey, queryFn, enabled = true }: UsePaginationOptions<T>) {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => queryFn(pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: PaginatedResponse<T>) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    enabled,
  });

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  return {
    items,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    error: query.error,
    refetch: query.refetch,
  };
}
