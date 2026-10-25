import { useListLocation } from './list-location';

import { useQueries, useQuery } from '@tanstack/react-query';
import { api, result } from './client';
import { collect, useReferences } from './data';
import { useCompany } from './session';

export function useOperationsPageState() {
  const c = useCompany();
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

  return { c, refs, history, setHistory, requests, handoffs, asset, authority };
}
