import { useQuery } from '@tanstack/react-query';
import { api, result } from './client';
import { useCompany } from './session';

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
