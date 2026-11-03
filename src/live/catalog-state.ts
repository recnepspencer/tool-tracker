import { useQuery } from '@tanstack/react-query';
import { api, result, type Model } from './client';
import { collect } from './data';
import { useListLocation } from './list-location';
import { useCompany } from './session';
import { useCommand } from './settings-command-state';

type ToolModel = Model<'ModelView'>;

export function useCatalogPageState() {
  const c = useCompany();
  const { params, update } = useListLocation();
  const archived = params.get('archived') === 'true';
  const search = params.get('search') ?? '';
  const categoryArchived = params.get('categories') === 'archived';
  const modelParam = params.get('model') ?? '';
  const categories = useCategoryOptions();
  const archive = useCommand();
  const models = useQuery({
    queryKey: [c.company_id, 'models', archived],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/tool-models', { params: { path: c.path, query: { offset, archived } } })
          .then(result),
      ),
  });
  const categoryName = (id: string) => categories.data?.find((category) => category.id === id)?.name ?? '';
  const term = search.trim().toLocaleLowerCase();
  const rows = (models.data ?? []).filter(
    (model) =>
      !term ||
      [model.name, model.manufacturer, model.model_number, categoryName(model.category_id)].some((value) =>
        value.toLocaleLowerCase().includes(term),
      ),
  );
  const select = (id: string) => {
    archive.reset();
    update('model', id);
  };

  return {
    c,
    archived,
    setArchived: (value: boolean) => update('archived', value ? 'true' : ''),
    search,
    setSearch: (value: string) => update('search', value),
    categories,
    categoryOptions: categories.data ?? [],
    categoryName,
    categoryArchived,
    setCategoryArchived: (value: boolean) => update('categories', value ? 'archived' : ''),
    models,
    rows,
    creating: modelParam === 'new',
    selected: models.data?.find((model) => model.id === modelParam),
    select,
    archive,
    setModelArchived: (model: ToolModel, value: boolean) =>
      void archive.run(
        () =>
          api.POST('/api/companies/{company_id}/tool-models/{model_id}/update', {
            params: { path: { ...c.path, model_id: model.id } },
            body: {
              expected_revision: model.revision,
              category_id: model.category_id,
              name: model.name,
              manufacturer: model.manufacturer,
              model_number: model.model_number,
              archived: value,
            },
          }),
        () => update('model', ''),
      ),
  };
}
export type CatalogPageState = ReturnType<typeof useCatalogPageState>;

export function useCategoryOptions({ enabled = true } = {}) {
  const c = useCompany();
  return useQuery({
    queryKey: [c.company_id, 'category-options'],
    enabled,
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
}
