import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../api/api-context';
import { queryKeys } from '../../api/query-keys';

export const toolCatalogQueryKey = queryKeys.catalog;

export function useToolCatalog() {
  const api = useApi();
  return useQuery({ queryKey: toolCatalogQueryKey, queryFn: () => api.tools.listCatalog() });
}
