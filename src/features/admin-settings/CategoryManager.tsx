import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { TextField } from '../../components/ui/TextField';
import type { ToolCategoryView } from '../../domain/read-models/settings';
import type { SettingsMutations } from './use-settings-mutations';

export function CategoryManager({
  categories,
  mutations,
  blocked,
}: {
  categories: readonly ToolCategoryView[];
  mutations: SettingsMutations;
  blocked: boolean;
}) {
  const [newCategory, setNewCategory] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const create = () =>
    void mutations.createCategory
      .mutateAsync({ name: newCategory })
      .then(() => setNewCategory(''))
      .catch(() => undefined);
  const rename = (category: ToolCategoryView) =>
    void mutations.renameCategory
      .mutateAsync({ categoryId: category.id, expectedRevision: category.revision, name: editingName })
      .then(() => setEditingCategory(null))
      .catch(() => undefined);
  return (
    <SurfaceCard className="settings-card">
      <div className="settings-card-heading">
        <span className="eyebrow">Tool categories</span>
      </div>
      <div className="category-create">
        <TextField label="New category" value={newCategory} onChange={setNewCategory} placeholder="e.g. Safety" />
        <Button onClick={create} disabled={blocked || mutations.createCategory.isPending || !newCategory.trim()}>
          Add category
        </Button>
      </div>
      <div className="category-list">
        {categories.map((category) => (
          <div className="category-row" key={category.id}>
            {editingCategory === category.id ? (
              <>
                <TextField label={`Rename ${category.name}`} hideLabel value={editingName} onChange={setEditingName} />
                <Button
                  variant="secondary"
                  onClick={() => rename(category)}
                  disabled={blocked || mutations.renameCategory.isPending || !editingName.trim()}
                >
                  Save
                </Button>
                <Button variant="ghost" onClick={() => setEditingCategory(null)}>
                  Cancel
                </Button>
              </>
            ) : (
              <CategoryRow
                category={category}
                blocked={blocked}
                pending={mutations.deleteCategory.isPending}
                onRename={() => {
                  setEditingCategory(category.id);
                  setEditingName(category.name);
                }}
                onDelete={() =>
                  void mutations.deleteCategory
                    .mutateAsync({ categoryId: category.id, expectedRevision: category.revision })
                    .catch(() => undefined)
                }
              />
            )}
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}

function CategoryRow({
  category,
  blocked,
  pending,
  onRename,
  onDelete,
}: {
  category: ToolCategoryView;
  blocked: boolean;
  pending: boolean;
  onRename(): void;
  onDelete(): void;
}) {
  return (
    <>
      <div>
        <strong>{category.name}</strong>
        <small>
          {category.usageCount} {category.usageCount === 1 ? 'tool' : 'tools'}
        </small>
      </div>
      <Button variant="ghost" onClick={onRename} disabled={blocked}>
        Rename
      </Button>
      <Button variant="danger" onClick={onDelete} disabled={blocked || category.usageCount > 0 || pending}>
        Delete
      </Button>
    </>
  );
}
