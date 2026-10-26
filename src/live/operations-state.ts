import { useListLocation } from './list-location';

import { useQueries, useQuery } from '@tanstack/react-query';
import { api, result } from './client';
import { collect, useReferences } from './data';
import { useCompany } from './session';

export function useOperationsPageState() {
  const c = useCompany();
  const reviewLocation = useListLocation();
  const review = reviewLocation.params.get('review');
  const kind = reviewLocation.params.get('kind') ?? '';
  const search = reviewLocation.params.get('search') ?? '';
  const warehouse = reviewLocation.params.get('warehouse') ?? '';
  const refs = useReferences();
  const historyLocation = useListLocation();
  const history = historyLocation.params.get('history') === 'true';
  const setHistory = (value: boolean) => historyLocation.update('history', value ? 'true' : '');
  const requests = useQuery({
    queryKey: [c.company_id, 'requests', history],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/tool-requests', {
            params: { path: c.path, query: { offset, pending: !history } },
          })
          .then(result),
      ),
  });
  const handoffs = useQuery({
    queryKey: [c.company_id, 'handoffs', history],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/handoffs', {
            params: { path: c.path, query: { offset, pending: !history } },
          })
          .then(result),
      ),
  });
  const ids = [...new Set([...(requests.data ?? []), ...(handoffs.data ?? [])].map((r) => r.asset_id))];
  const assets = useQueries({
    queries: ids.map((asset_id) => ({
      queryKey: [c.company_id, 'tool', asset_id],
      queryFn: () =>
        api
          .GET('/api/companies/{company_id}/tools/{asset_id}', { params: { path: { ...c.path, asset_id } } })
          .then(result),
    })),
  });
  const asset = (id: string) => assets.find((a) => a.data?.id === id)?.data;
  const authority = (warehouse: string | null | undefined) =>
    !!warehouse && (c.can('tools.manage') || c.managed_warehouse_ids.includes(warehouse));

  return {
    c,
    refs,
    history,
    setHistory,
    requests: {
      ...requests,
      data: requests.data?.filter(
        (item) =>
          kind !== 'return' &&
          (!warehouse || asset(item.asset_id)?.warehouse_id === warehouse) &&
          `${asset(item.asset_id)?.name ?? ''} ${asset(item.asset_id)?.asset_tag ?? ''} ${refs.person(item.requester_id)}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    },
    handoffs: {
      ...handoffs,
      data: handoffs.data?.filter(
        (item) =>
          kind !== 'request' &&
          (kind !== 'return' || item.destination_warehouse_id !== null) &&
          (!warehouse ||
            item.destination_warehouse_id === warehouse ||
            asset(item.asset_id)?.warehouse_id === warehouse) &&
          `${asset(item.asset_id)?.name ?? ''} ${asset(item.asset_id)?.asset_tag ?? ''}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    },
    asset,
    authority,
    review,
    openReview: (id: string) => reviewLocation.update('review', id),
    kind,
    search,
    warehouse,
    setKind: (value: string) => reviewLocation.update('kind', value),
    setSearch: (value: string) => reviewLocation.update('search', value),
    setWarehouse: (value: string) => reviewLocation.update('warehouse', value),
  };
}
