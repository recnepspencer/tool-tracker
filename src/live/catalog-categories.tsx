import { api, type Model } from './client';
import { useCompany } from './session';
import { Empty, Field, Form, text } from './ui';
import './experience/catalog-categories.css';

export function CategoryCreate({ label = 'Category name' }: { label?: string }) {
  const c = useCompany();
  return (
    <Form
      label="Create category"
      onDone={(form) => form.reset()}
      submit={(form) =>
        api.POST('/api/companies/{company_id}/tool-categories', {
          params: { path: c.path },
          body: { name: text(form, 'name') },
        })
      }
    >
      <Field label={label} name="name" required maxLength={120} />
    </Form>
  );
}

export function CategoryList({ categories }: { categories: Model<'CategoryView'>[] | undefined }) {
  const c = useCompany();
  return (
    <div className="catalog-category-list">
      {categories?.map((category) => (
        <details key={category.id}>
          <summary>{category.name}</summary>
          <Form
            label="Save category"
            submit={(form) =>
              api.POST('/api/companies/{company_id}/tool-categories/{category_id}/update', {
                params: { path: { ...c.path, category_id: category.id } },
                body: {
                  expected_revision: category.revision,
                  name: text(form, 'name'),
                  archived: form.get('archive') === 'on',
                },
              })
            }
          >
            <Field label="Category name" name="name" defaultValue={category.name} required maxLength={120} />
            <label className="check">
              <input type="checkbox" name="archive" defaultChecked={!!category.archived_at} /> Archived
            </label>
          </Form>
        </details>
      ))}
      {categories?.length === 0 && <Empty>No categories in this view.</Empty>}
    </div>
  );
}
