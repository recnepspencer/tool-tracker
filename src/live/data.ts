import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { api, result } from './client';
import { useCompany } from './session';

// Large pages keep the number of round trips low on high-latency connections.
const TOOL_PAGE = 500;

/**
 * Every tool unit visible to this member, or only those they hold. The first
 * page renders as soon as it arrives; later pages load behind it, so a large
 * company does not wait for its whole inventory over a slow connection.
 */
export function useToolCollection(mine = false, { enabled = true } = {}) {
  const c = useCompany();
  const query = useInfiniteQuery({
    queryKey: [c.company_id, 'asset-collection', mine],
    enabled,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      api
        .GET('/api/companies/{company_id}/tools', {
          params: {
            path: c.path,
            query: {
              offset: pageParam,
              limit: TOOL_PAGE,
              ...(mine ? { holder_membership_id: c.membership_id } : {}),
            },
          },
          signal,
        })
        .then(result),
    getNextPageParam: (page) => page.next_offset ?? undefined,
  });
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = query;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isError) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage]);
  const data = useMemo(() => query.data?.pages.flatMap((page) => page.items), [query.data]);
  return {
    data,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    isFetching: query.isFetching,
    /** True while later pages are still arriving behind the first. */
    loadingMore: !!hasNextPage,
    refetch: query.refetch,
  };
}

export async function collect<T>(
  load: (offset: number) => Promise<{ items: T[]; next_offset: number | null }>,
): Promise<T[]> {
  const items: T[] = [];
  let offset: number | null = 0;
  while (offset !== null) {
    const page = await load(offset);
    items.push(...page.items);
    offset = page.next_offset;
  }
  return items;
}
export function usePeople({ enabled = true } = {}) {
  const { path, company_id } = useCompany();
  return useQuery({
    queryKey: [company_id, 'people'],
    enabled,
    queryFn: () =>
      collect((offset) =>
        api.GET('/api/companies/{company_id}/people', { params: { path, query: { offset, limit: 100 } } }).then(result),
      ),
  });
}
export function useReferences() {
  const { path, company_id, can } = useCompany();
  const people = usePeople();
  const warehouses = useQuery({
    queryKey: [company_id, 'warehouses'],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/warehouses', { params: { path, query: { offset, limit: 100 } } })
          .then(result),
      ),
  });
  const models = useQuery({
    queryKey: [company_id, 'models'],
    enabled: can('tools.read'),
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/tool-models', { params: { path, query: { offset, limit: 100 } } })
          .then(result),
      ),
  });
  return {
    people,
    warehouses,
    models,
    person: (id: string | null) => people.data?.find((p) => p.id === id)?.preferred_name ?? 'Former team member',
    warehouse: (id: string | null) => warehouses.data?.find((w) => w.id === id)?.name ?? 'Archived warehouse',
  };
}
