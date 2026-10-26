import { useQuery } from '@tanstack/react-query';
import { api, result } from './client';
import { collect, useReferences } from './data';
import { useListLocation } from './list-location';
import { useCompany } from './session';

export function useCatalogPageState() {
  const c = useCompany();
  const refs = useReferences();
  const archivedLocation = useListLocation();
  const archived = archivedLocation.params.get('archived') === 'true';
  const setArchived = (value: boolean) => archivedLocation.update('archived', value ? 'true' : '');
  const warehouses = useQuery({
    queryKey: [c.company_id, 'warehouses', archived],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/warehouses', { params: { path: c.path, query: { offset, archived } } })
          .then(result),
      ),
  });
  const categories = useQuery({
    queryKey: [c.company_id, 'category-options'],
    queryFn: async () =>
      (
        await Promise.all(
          [false, true].map((archived) =>
            collect((offset) =>
              api
                .GET('/api/companies/{company_id}/tool-categories', {
                  params: { path: c.path, query: { offset, archived } },
                })
                .then(result),
            ),
          ),
        )
      ).flat(),
  });
  const models = useQuery({
    queryKey: [c.company_id, 'models', archived],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/tool-models', { params: { path: c.path, query: { offset, archived } } })
          .then(result),
      ),
  });

  return {
    c,
    refs,
    archived,
    setArchived,
    warehouses,
    categoryOptions: categories.data ?? [],
    categories: { ...categories, data: categories.data?.filter((item) => Boolean(item.archived_at) === archived) },
    models,
  };
}
