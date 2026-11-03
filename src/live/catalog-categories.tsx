import { CategoryManager } from './category-manager';
import type { CatalogPageState } from './catalog-state';

/** Catalog's category card: the shared CategoryManager with its own status param. */
export function CatalogCategories({
  state,
}: {
  state: Pick<CatalogPageState, 'categories' | 'categoryArchived' | 'setCategoryArchived'>;
}) {
  return (
    <CategoryManager
      categories={state.categories}
      archived={state.categoryArchived}
      onArchivedChange={state.setCategoryArchived}
    />
  );
}
