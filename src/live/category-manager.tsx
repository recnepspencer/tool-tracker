import type { UseQueryResult } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { api, type Model } from './client';
import { formatDate } from './format';
import { Button, ErrorState, LoadingState, SelectField, TextField } from './kit';
import { useCompany } from './session';
import { CommandError, CommandForm, SettingsCard } from './settings-command';
import { useCommand } from './settings-command-state';
import { Field, text } from './ui';

type Category = Model<'CategoryView'>;

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active categories' },
  { value: 'archived', label: 'Archived categories' },
];

/**
 * The demo's CategoryManager, shared by Settings and Catalog. Live categories
 * are archived rather than deleted, and the API reports no usage count.
 */
export function CategoryManager({
  categories,
  archived,
  onArchivedChange,
  footer,
}: {
  categories: UseQueryResult<Category[]>;
  archived: boolean;
  onArchivedChange(archived: boolean): void;
  footer?: ReactNode;
}) {
  const c = useCompany();
  const command = useCommand();
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const visible = categories.data?.filter((category) => Boolean(category.archived_at) === archived);
  const save = (category: Category, change: { name?: string; archived?: boolean }) =>
    void command.run(
      () =>
        api.POST('/api/companies/{company_id}/tool-categories/{category_id}/update', {
          params: { path: { ...c.path, category_id: category.id } },
          body: {
            expected_revision: category.revision,
            name: change.name ?? category.name,
            archived: change.archived ?? Boolean(category.archived_at),
          },
        }),
      () => setEditing(null),
    );
  return (
    <SettingsCard eyebrow="Tool categories">
      <CommandForm
        className="category-create"
        errorAfter
        label="Add category"
        busyLabel="Adding…"
        onDone={(form) => form.reset()}
        submit={(form) =>
          api.POST('/api/companies/{company_id}/tool-categories', {
            params: { path: c.path },
            body: { name: text(form, 'name') },
          })
        }
      >
        <Field label="New category" name="name" placeholder="e.g. Safety" required maxLength={120} />
      </CommandForm>
      <SelectField
        label="Category status"
        compact
        searchable={false}
        value={archived ? 'archived' : 'active'}
        onChange={(value) => {
          setEditing(null);
          command.reset();
          onArchivedChange(value === 'archived');
        }}
        options={STATUS_OPTIONS}
      />
      {categories.isPending && !categories.data && <LoadingState label="Loading categories…" />}
      {categories.isError && (
        <ErrorState message="Tool categories could not be loaded." onRetry={() => void categories.refetch()} />
      )}
      {visible && (
        <div className="category-list">
          {visible.map((category) => (
            <div className="category-row" key={category.id}>
              {editing === category.id ? (
                <>
                  <TextField
                    label={`Rename ${category.name}`}
                    hideLabel
                    value={name}
                    onChange={setName}
                    maxLength={120}
                  />
                  <Button
                    variant="secondary"
                    disabled={command.busy || !name.trim()}
                    onClick={() => save(category, { name: name.trim() })}
                  >
                    {command.busy ? 'Saving…' : 'Save'}
                  </Button>
                  <Button variant="ghost" disabled={command.busy} onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <div>
                    <strong>{category.name}</strong>
                    {category.archived_at && <small>Archived {formatDate(category.archived_at)}</small>}
                  </div>
                  <Button
                    variant="ghost"
                    disabled={command.busy}
                    aria-label={`Rename ${category.name}`}
                    onClick={() => {
                      command.reset();
                      setEditing(category.id);
                      setName(category.name);
                    }}
                  >
                    Rename
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={command.busy}
                    aria-label={`${category.archived_at ? 'Restore' : 'Archive'} ${category.name}`}
                    onClick={() => save(category, { archived: !category.archived_at })}
                  >
                    {category.archived_at ? 'Restore' : 'Archive'}
                  </Button>
                </>
              )}
            </div>
          ))}
          {!visible.length && (
            <p className="settings-muted">{archived ? 'No archived categories.' : 'No active categories yet.'}</p>
          )}
        </div>
      )}
      <CommandError error={command.error} />
      {footer}
    </SettingsCard>
  );
}
