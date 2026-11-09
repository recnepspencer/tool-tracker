import { useQuery } from '@tanstack/react-query';
import { api, result, type Model } from './client';
import { collect } from './data';
import { useListLocation } from './list-location';
import { useCompany } from './session';
import { useCommand } from './settings-command-state';

type ToolModel = Model<'ModelView'>;
type Category = Model<'CategoryView'>;

export function useCatalogPageState() {
  const c = useCompany();
  const { params, update } = useListLocation();
  // Models and categories are separate views; each keeps its own search and status in the URL.
  const view: 'models' | 'categories' = params.get('view') === 'categories' ? 'categories' : 'models';
  const archived = params.get('archived') === 'true';
  const search = params.get('search') ?? '';
  const category = params.get('category') ?? '';
  const modelParam = params.get('model') ?? '';
  const categoryParam = params.get('edit-category') ?? '';
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
      (!category || model.category_id === category) &&
      (!term ||
        [model.name, model.manufacturer, model.model_number, categoryName(model.category_id)].some((value) =>
          value.toLocaleLowerCase().includes(term),
        )),
  );
  const categoryRows = (categories.data ?? []).filter(
    (item) => Boolean(item.archived_at) === archived && (!term || item.name.toLocaleLowerCase().includes(term)),
  );
  const select = (id: string) => {
    archive.reset();
    update('model', id);
  };
  const selectCategory = (id: string) => {
    archive.reset();
    update('edit-category', id);
  };

  return {
    c,
    view,
    setView: (value: 'models' | 'categories') => {
      for (const key of ['search', 'archived', 'category', 'model', 'edit-category']) update(key, '');
      update('view', value === 'categories' ? 'categories' : '');
    },
    category,
    setCategory: (value: string) => update('category', value === 'all' ? '' : value),
    categoryRows,
    creatingCategory: categoryParam === 'new',
    selectedCategory: categories.data?.find((item) => item.id === categoryParam),
    selectCategory,
    setCategoryArchived: (item: Category, value: boolean) =>
      void archive.run(
        () =>
          api.POST('/api/companies/{company_id}/tool-categories/{category_id}/update', {
            params: { path: { ...c.path, category_id: item.id } },
            body: { expected_revision: item.revision, name: item.name, archived: value },
          }),
        () => update('edit-category', ''),
      ),
    archived,
    setArchived: (value: boolean) => update('archived', value ? 'true' : ''),
    search,
    setSearch: (value: string) => update('search', value),
    categories,
    categoryOptions: categories.data ?? [],
    categoryName,
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
