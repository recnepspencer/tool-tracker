import { CatalogCategories } from './catalog-categories';
import { useCatalogPageState, type CatalogPageState } from './catalog-state';
import { api, type Model } from './client';
import {
  Button,
  DirectoryToolbar,
  ErrorState,
  LoadingState,
  OverlayDialog,
  PageHeading,
  SelectField,
  SurfaceCard,
} from './kit';
import { CommandError, CommandForm } from './settings-command';
import { Field, text } from './ui';

type ToolModel = Model<'ModelView'>;
type ModelTab = 'active' | 'archived';

const MODEL_TABS: { value: ModelTab; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

export function CatalogPage() {
  const state = useCatalogPageState();
  const { c, models, rows, archived, selected } = state;
  const manages = c.can('catalog.manage');
  if (models.isPending && !models.data) return <LoadingState label="Loading catalog…" />;
  if (!models.data)
    return <ErrorState message="The tool catalog could not be loaded." onRetry={() => void models.refetch()} />;
  return (
    <div className="page-content">
      <PageHeading
        eyebrow="Admin view · Catalog"
        title="Catalog"
        description="Tool types describe a kind of tool. Registered tools are individual assets."
        action={manages ? <Button onClick={() => state.select('new')}>Add tool type</Button> : undefined}
      />
      {models.isError && (
        <ErrorState message="The tool catalog could not be refreshed." onRetry={() => void models.refetch()} />
      )}
      <DirectoryToolbar<ModelTab>
        searchLabel="Search tool types"
        searchPlaceholder="Search tool types…"
        search={state.search}
        onSearchChange={state.setSearch}
        filterLabel="Tool type status"
        filters={MODEL_TABS}
        activeFilter={archived ? 'archived' : 'active'}
        onFilterChange={(value) => state.setArchived(value === 'archived')}
      />
      <SurfaceCard className="admin-table-card">
        <div className="admin-table-wrap">
          <table className="admin-table admin-table--responsive directory-table">
            <thead>
              <tr>
                <th>Tool type</th>
                <th>Category</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((model) => (
                <tr key={model.id}>
                  <td data-label="Tool type">
                    <button className="admin-record-button" type="button" onClick={() => state.select(model.id)}>
                      {model.name}
                    </button>
                    {(model.manufacturer || model.model_number) && (
                      <span>{[model.manufacturer, model.model_number].filter(Boolean).join(' · ')}</span>
                    )}
                  </td>
                  <td className="directory-table__mobile-hide" data-label="Category">
                    {state.categoryName(model.category_id) || '—'}
                  </td>
                  <td className="directory-table__status" data-label="Status">
                    {model.archived_at ? (
                      <span className="lifecycle-pill lifecycle-pill--removed">Archived</span>
                    ) : (
                      <span className="lifecycle-pill lifecycle-pill--active">Active</span>
                    )}
                  </td>
                  <td className="directory-table__actions" data-label="Actions">
                    <Button
                      variant="ghost"
                      onClick={() => state.select(model.id)}
                      aria-label={`${manages ? 'Edit' : 'Open'} ${model.name}`}
                    >
                      {manages ? 'Edit' : 'Open'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <p className="admin-empty">
            {models.data.length
              ? 'No tool types match this search.'
              : archived
                ? 'No archived tool types.'
                : 'No tool types yet.'}
          </p>
        )}
      </SurfaceCard>
      {manages && state.creating && <ModelDialog state={state} />}
      {selected && <ModelDialog key={selected.id} model={selected} state={state} />}
      {manages && <CatalogCategories state={state} />}
    </div>
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
      label={model ? 'Edit tool type' : 'Create tool type'}
      onClose={close}
      panelClassName="admin-dialog"
      showCloseButton
    >
      <div className="dialog-heading">
        <span className="eyebrow">Catalog</span>
        <h2>{model ? (manages ? 'Edit tool type' : model.name) : 'Add a tool type'}</h2>
        {model && (model.manufacturer || model.model_number) && (
          <p>{[model.manufacturer, model.model_number].filter(Boolean).join(' · ')}</p>
        )}
      </div>
      {manages ? (
        <CommandForm
          label="Save tool type"
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
          <SelectField
            label="Category"
            name="category"
            required
            defaultValue={model?.category_id}
            placeholder="Choose a category"
            emptyMessage="No active categories"
            options={categories}
          />
          <Field label="Tool name" name="name" defaultValue={model?.name} required maxLength={200} />
          <Field
            label="Manufacturer"
            name="manufacturer"
            defaultValue={model?.manufacturer}
            hint="Optional"
            maxLength={120}
          />
          <Field
            label="Model number"
            name="number"
            defaultValue={model?.model_number}
            hint="Optional"
            maxLength={120}
          />
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
          <span className="eyebrow">Tool type status</span>
          <Button
            variant="secondary"
            disabled={archive.busy}
            onClick={() => state.setModelArchived(model, !model.archived_at)}
          >
            {archive.busy ? 'Saving…' : model.archived_at ? 'Restore tool type' : 'Archive tool type'}
          </Button>
          <CommandError error={archive.error} />
        </div>
      )}
    </OverlayDialog>
  );
}
