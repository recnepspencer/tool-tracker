import { useCatalogPageState, type CatalogPageState } from './catalog-state';
import { api, type Model } from './client';
import {
  ArchivableList,
  Button,
  DirectoryToolbar,
  ErrorState,
  FieldGroup,
  LoadingState,
  OverlayDialog,
  PageHeading,
  RecordList,
  SelectField,
  UndoToast,
} from './kit';
import { CommandError, CommandForm } from './settings-command';
import { Field, text } from './ui';

type ToolModel = Model<'ModelView'>;
type Category = Model<'CategoryView'>;

export function CatalogPage() {
  const state = useCatalogPageState();
  const { c, models, view } = state;
  const manages = c.can('catalog.manage');
  if (models.isPending && !models.data) return <LoadingState label="Loading catalog…" />;
  if (!models.data)
    return <ErrorState message="The tool catalog could not be loaded." onRetry={() => void models.refetch()} />;
  const categoriesView = view === 'categories';
  return (
    <div className="page-content">
      <PageHeading
        title="Catalog"
        description="Models describe a kind of tool. Categories group models."
        action={
          manages ? (
            <Button onClick={() => (categoriesView ? state.selectCategory('new') : state.select('new'))}>
              {categoriesView ? 'Add category' : 'Add model'}
            </Button>
          ) : undefined
        }
      />
      <div className="operations-tabs segmented" role="tablist" aria-label="Catalog">
        {(['models', 'categories'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={view === value}
            className={view === value ? 'operations-tab operations-tab--active' : 'operations-tab'}
            onClick={() => view !== value && state.setView(value)}
          >
            {value === 'models' ? 'Models' : 'Categories'}
          </button>
        ))}
      </div>
      {categoriesView ? <CategoryDirectory state={state} /> : <ModelDirectory state={state} />}
      {!state.selected && !state.selectedCategory && <CommandError error={state.archive.error} />}
      {state.undo && (
        <UndoToast
          key={state.undo.id}
          message={state.undo.message}
          onUndo={state.runUndo}
          onDismiss={state.dismissUndo}
        />
      )}
    </div>
  );
}

function ModelDirectory({ state }: { state: CatalogPageState }) {
  const { c, models, rows, archived, selected } = state;
  const manages = c.can('catalog.manage');
  const categoryFilter = [
    { value: 'all', label: 'All categories' },
    ...state.categoryOptions
      .filter((category) => !category.archived_at || category.id === state.category)
      .map((category) => ({ value: category.id, label: category.name })),
  ];
  return (
    <>
      {models.isError && (
        <ErrorState message="The tool catalog could not be refreshed." onRetry={() => void models.refetch()} />
      )}
      <DirectoryToolbar
        searchLabel="Search models"
        searchPlaceholder="Search models…"
        search={state.search}
        onSearchChange={state.setSearch}
        trailing={
          <SelectField
            compact
            hideLabel
            searchable={false}
            label="Category"
            value={state.category || 'all'}
            onChange={state.setCategory}
            options={categoryFilter}
          />
        }
      />
      <ArchivableList archived={archived} noun="models" onArchivedChange={state.setArchived}>
        <RecordList
          label={archived ? 'Archived models' : 'Models'}
          items={rows.map((model) => ({
            id: model.id,
            title: model.name,
            detail: `${model.manufacturer} · ${model.model_number}`,
            meta: state.categoryName(model.category_id),
            label: `${manages ? 'Edit' : 'Open'} ${model.name}`,
          }))}
          empty={
            models.data?.length
              ? 'No models match this search.'
              : archived
                ? 'No archived models.'
                : 'No tool models yet.'
          }
          onSelect={state.select}
        />
      </ArchivableList>
      {manages && state.creating && <ModelDialog state={state} />}
      {selected && <ModelDialog key={selected.id} model={selected} state={state} />}
    </>
  );
}

function CategoryDirectory({ state }: { state: CatalogPageState }) {
  const { c, categories, categoryRows, archived, selectedCategory } = state;
  const manages = c.can('catalog.manage');
  if (categories.isPending && !categories.data) return <LoadingState label="Loading categories…" />;
  if (!categories.data)
    return <ErrorState message="Tool categories could not be loaded." onRetry={() => void categories.refetch()} />;
  return (
    <>
      <DirectoryToolbar
        searchLabel="Search categories"
        searchPlaceholder="Search categories…"
        search={state.search}
        onSearchChange={state.setSearch}
      />
      <ArchivableList archived={archived} noun="categories" onArchivedChange={state.setArchived}>
        <RecordList
          label={archived ? 'Archived categories' : 'Categories'}
          items={categoryRows.map((category) => ({
            id: category.id,
            title: category.name,
            label: `${manages ? 'Edit' : 'Open'} ${category.name}`,
          }))}
          empty={
            state.search
              ? 'No categories match this search.'
              : archived
                ? 'No archived categories.'
                : 'No categories yet. Add one to group your models.'
          }
          onSelect={state.selectCategory}
        />
      </ArchivableList>
      {manages && state.creatingCategory && <CategoryDialog state={state} />}
      {selectedCategory && <CategoryDialog key={selectedCategory.id} category={selectedCategory} state={state} />}
    </>
  );
}

function CategoryDialog({ category, state }: { category?: Category; state: CatalogPageState }) {
  const { c, archive } = state;
  const manages = c.can('catalog.manage');
  const close = () => state.selectCategory('');
  return (
    <OverlayDialog
      label={category ? category.name : 'Add category'}
      onClose={close}
      panelClassName="admin-dialog"
      showCloseButton
    >
      <div className="dialog-heading">
        <span className="eyebrow">Catalog</span>
        <h2>{category ? (manages ? 'Edit category' : category.name) : 'Add a category'}</h2>
      </div>
      {manages && (
        <CommandForm
          label={category ? 'Save category' : 'Add category'}
          onCancel={close}
          onDone={close}
          submit={(form) =>
            category
              ? api.POST('/api/companies/{company_id}/tool-categories/{category_id}/update', {
                  params: { path: { ...c.path, category_id: category.id } },
                  body: {
                    expected_revision: category.revision,
                    name: text(form, 'name'),
                    archived: Boolean(category.archived_at),
                  },
                })
              : api.POST('/api/companies/{company_id}/tool-categories', {
                  params: { path: c.path },
                  body: { name: text(form, 'name') },
                })
          }
        >
          <FieldGroup>
            <Field
              label="Category name"
              name="name"
              defaultValue={category?.name}
              placeholder="e.g. Safety"
              required
              maxLength={120}
            />
          </FieldGroup>
        </CommandForm>
      )}
      {category && manages && (
        <div className="admin-danger-zone">
          <span className="eyebrow">Category status</span>
          <Button
            variant="secondary"
            disabled={archive.busy}
            onClick={() => state.setCategoryArchived(category, !category.archived_at)}
          >
            {archive.busy ? 'Saving…' : category.archived_at ? 'Restore category' : 'Archive category'}
          </Button>
          <CommandError error={archive.error} />
        </div>
      )}
    </OverlayDialog>
  );
}

function ModelDialog({ model, state }: { model?: ToolModel; state: CatalogPageState }) {
  const { c, archive } = state;
  const manages = c.can('catalog.manage');
  const close = () => state.select('');
  const categories = state.categoryOptions
    .filter((category) => !category.archived_at || category.id === model?.category_id)
    .map((category) => ({
      value: category.id,
      label: category.name,
      description: category.archived_at ? 'Archived category' : undefined,
    }));
  return (
    <OverlayDialog
      label={model ? 'Edit model' : 'Create model'}
      onClose={close}
      panelClassName="admin-dialog"
      showCloseButton
    >
      <div className="dialog-heading">
        <span className="eyebrow">Catalog</span>
        <h2>{model ? (manages ? 'Edit model' : model.name) : 'Add a model'}</h2>
        {model && (
          <p>
            {model.manufacturer} · {model.model_number}
          </p>
        )}
      </div>
      {manages ? (
        <CommandForm
          label="Save model"
          onCancel={close}
          onDone={close}
          submit={(form) => {
            const category = text(form, 'category');
            if (!category) return Promise.reject(new Error('Choose a category.'));
            const fields = {
              category_id: category,
              name: text(form, 'name'),
              manufacturer: text(form, 'manufacturer'),
              model_number: text(form, 'number'),
            };
            return model
              ? api.POST('/api/companies/{company_id}/tool-models/{model_id}/update', {
                  params: { path: { ...c.path, model_id: model.id } },
                  body: { ...fields, expected_revision: model.revision, archived: Boolean(model.archived_at) },
                })
              : api.POST('/api/companies/{company_id}/tool-models', { params: { path: c.path }, body: fields });
          }}
        >
          <FieldGroup>
            <SelectField
              label="Category"
              name="category"
              required
              defaultValue={model?.category_id}
              placeholder="Choose a category"
              emptyMessage="No active categories. Add one on the Categories tab."
              options={categories}
            />
            <Field label="Tool name" name="name" defaultValue={model?.name} required maxLength={200} />
            <Field
              label="Manufacturer"
              name="manufacturer"
              defaultValue={model?.manufacturer}
              required
              maxLength={120}
            />
            <Field label="Model number" name="number" defaultValue={model?.model_number} required maxLength={120} />
          </FieldGroup>
        </CommandForm>
      ) : (
        model && (
          <div className="admin-detail-list">
            <div>
              <strong>Category</strong>
              <span>{state.categoryName(model.category_id) || '—'}</span>
            </div>
          </div>
        )
      )}
      {model && manages && (
        <div className="admin-danger-zone">
          <span className="eyebrow">Model status</span>
          <Button
            variant="secondary"
            disabled={archive.busy}
            onClick={() => state.setModelArchived(model, !model.archived_at)}
          >
            {archive.busy ? 'Saving…' : model.archived_at ? 'Restore model' : 'Archive model'}
          </Button>
          <CommandError error={archive.error} />
        </div>
      )}
    </OverlayDialog>
  );
}
