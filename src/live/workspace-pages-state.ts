import { useQuery } from '@tanstack/react-query';
import { api, result } from './client';
import { useCatalogPageState } from './catalog-state';
import { useListLocation } from './list-location';
import { useCompany } from './session';

export function useWarehouseDirectory() {
  const catalog = useCatalogPageState();
  const { params, update } = useListLocation();
  return {
    ...catalog,
    selected: catalog.warehouses.data?.find((item) => item.id === params.get('warehouse')),
    creating: params.get('warehouse') === 'new',
    select: (id: string) => update('warehouse', id),
  };
}
export function useAccessDirectory() {
  const c = useCompany();
  const access = useQuery({
    queryKey: [c.company_id, 'permissions'],
    queryFn: () => api.GET('/api/companies/{company_id}/permissions', { params: { path: c.path } }).then(result),
  });
  return { c, access };
}
