import { useState } from 'react';
import { api, errorMessage, result } from './client';
import { useCategoryOptions } from './catalog-state';
import { useReferences } from './data';
import { Button, SelectField } from './kit';
import { useCompany } from './session';
import { Field } from './ui';

/** Creates a catalog type/category without leaving or submitting the equipment form. */
export function EquipmentTypePicker({ defaultValue = '', name = 'model' }: { defaultValue?: string; name?: string }) {
  const c = useCompany();
  const refs = useReferences();
  const categories = useCategoryOptions();
  const [selected, setSelected] = useState(defaultValue);
  const [adding, setAdding] = useState(false);
  const [typeName, setTypeName] = useState('');
  const [category, setCategory] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    if (busy) return;
    setError('');
    if (!typeName.trim() || !category || (category === 'new' && !categoryName.trim())) {
      setError('Enter an equipment type and choose or create a category.');
      return;
    }
    setBusy(true);
    try {
      let categoryId = category;
      if (category === 'new') {
        const match = categories.data?.find(
          (item) => !item.archived_at && item.name.toLowerCase() === categoryName.trim().toLowerCase(),
        );
        categoryId =
          match?.id ??
          result(
            await api.POST('/api/companies/{company_id}/tool-categories', {
              params: { path: c.path },
              body: { name: categoryName.trim() },
            }),
          ).id;
        setCategory(categoryId);
        await categories.refetch();
      }
      const match = refs.models.data?.find(
        (item) =>
          item.registrable &&
          item.category_id === categoryId &&
          item.name.toLowerCase() === typeName.trim().toLowerCase(),
      );
      const type =
        match ??
        result(
          await api.POST('/api/companies/{company_id}/tool-models', {
            params: { path: c.path },
            body: { category_id: categoryId, name: typeName.trim(), manufacturer: '', model_number: '' },
          }),
        );
      await refs.models.refetch();
      setSelected(type.id);
      setAdding(false);
      setTypeName('');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <SelectField
        label="Tool type"
        presentation="sheet"
        name={name}
        value={selected}
        onChange={setSelected}
        required
        options={(refs.models.data ?? [])
          .filter((item) => item.registrable)
          .map((item) => ({
            value: item.id,
            label: [item.manufacturer, item.name].filter(Boolean).join(' '),
            description: item.model_number,
          }))}
      />
      {c.can('catalog.manage') && !adding && (
        <Button type="button" variant="ghost" onClick={() => setAdding(true)}>
          Add tool type
        </Button>
      )}
      {adding && (
        <fieldset disabled={busy} aria-label="New equipment type" className="admin-form">
          <Field
            label="New tool type"
            value={typeName}
            onChange={(event) => setTypeName(event.target.value)}
            maxLength={200}
          />
          <SelectField
            label="Category"
            presentation="sheet"
            value={category}
            onChange={setCategory}
            options={[
              ...(categories.data ?? [])
                .filter((item) => !item.archived_at)
                .map((item) => ({ value: item.id, label: item.name })),
              { value: 'new', label: 'Add category…' },
            ]}
          />
          {category === 'new' && (
            <Field
              label="New category"
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              maxLength={120}
            />
          )}
          <Button type="button" onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save tool type'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
            Cancel new type
          </Button>
        </fieldset>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {(refs.models.error || categories.error) && (
        <p role="alert" className="form-error">
          Catalog could not be loaded. Try reopening this form.
        </p>
      )}
    </div>
  );
}
