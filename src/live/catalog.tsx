import { useCatalogPageState } from './catalog-state';

import { api, errorMessage } from './client';

import { Field, Form, Notice, Section, Select, text } from './ui';

export function CatalogPage() {
  const { c, refs, archived, setArchived, warehouses, categories, models } = useCatalogPageState();
  return (
    <>
      <h1>Catalog & warehouses</h1>
      <p className="muted">Models describe a kind of tool. Registered tools are individual assets.</p>
      <div className="detail-grid">
        {c.can('warehouses.manage') && (
          <Section title="Add warehouse">
            <Form
              label="Create warehouse"
              submit={(f) =>
                api.POST('/api/companies/{company_id}/warehouses', {
                  params: { path: c.path },
                  body: { code: text(f, 'code'), name: text(f, 'name'), address: text(f, 'address') },
                })
              }
            >
              <Field label="Code" name="code" required maxLength={40} />
              <Field label="Name" name="name" required maxLength={200} />
              <Field label="Address" name="address" maxLength={2000} />
            </Form>
          </Section>
        )}
        {c.can('catalog.manage') && (
          <>
            <Section title="Add category">
              <Form
                label="Create category"
                submit={(f) =>
                  api.POST('/api/companies/{company_id}/tool-categories', {
                    params: { path: c.path },
                    body: { name: text(f, 'name') },
                  })
                }
              >
                <Field label="Category name" name="name" required maxLength={120} />
              </Form>
            </Section>
            <Section title="Add model">
              <Form
                label="Create model"
                submit={(f) =>
                  api.POST('/api/companies/{company_id}/tool-models', {
                    params: { path: c.path },
                    body: {
                      category_id: text(f, 'category'),
                      name: text(f, 'name'),
                      manufacturer: text(f, 'manufacturer'),
                      model_number: text(f, 'number'),
                    },
                  })
                }
              >
                <Select label="Category" name="category">
                  <option value="">Choose a category</option>
                  {categories.data
                    ?.filter((x) => !x.archived_at)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                </Select>
                <Field label="Tool name" name="name" required maxLength={200} />
                <Field label="Manufacturer" name="manufacturer" required maxLength={120} />
                <Field label="Model number" name="number" required maxLength={120} />
              </Form>
            </Section>
          </>
        )}
      </div>
      <label className="check">
        <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Show archived
        records
      </label>
      {warehouses.error && <Notice error>{errorMessage(warehouses.error)}</Notice>}
      {categories.error && <Notice error>{errorMessage(categories.error)}</Notice>}
      {models.error && <Notice error>{errorMessage(models.error)}</Notice>}
      <Section title="Warehouses">
        {warehouses.data?.map((w) => (
          <details key={w.id}>
            <summary>
              {w.code} · {w.name}
            </summary>
            <Form
              label="Save warehouse"
              submit={(f) =>
                api.POST('/api/companies/{company_id}/warehouses/{warehouse_id}/update', {
                  params: { path: { ...c.path, warehouse_id: w.id } },
                  body: {
                    expected_revision: w.revision,
                    name: text(f, 'name'),
                    address: text(f, 'address'),
                    archived: f.get('archive') === 'on',
                  },
                })
              }
            >
              <Field label="Name" name="name" defaultValue={w.name} required maxLength={200} />
              <Field label="Address" name="address" defaultValue={w.address} maxLength={2000} />
              <label className="check">
                <input type="checkbox" name="archive" defaultChecked={!!w.archived_at} /> Archived
              </label>
            </Form>
            <Form
              label="Update warehouse manager"
              submit={(f) =>
                api.POST('/api/companies/{company_id}/warehouses/{warehouse_id}/authority', {
                  params: { path: { ...c.path, warehouse_id: w.id } },
                  body: {
                    expected_revision: w.revision,
                    membership_id: text(f, 'member'),
                    enabled: text(f, 'enabled') === 'true',
                  },
                })
              }
            >
              <Select label="Person" name="member">
                <option value="">Choose a person</option>
                {refs.people.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.preferred_name}
                  </option>
                ))}
              </Select>
              <Select label="Warehouse authority" name="enabled">
                <option value="true">Grant management authority</option>
                <option value="false">Revoke management authority</option>
              </Select>
            </Form>
          </details>
        ))}
      </Section>
      <Section title="Categories">
        {categories.data?.map((cat) => (
          <details key={cat.id}>
            <summary>{cat.name}</summary>
            <Form
              label="Save category"
              submit={(f) =>
                api.POST('/api/companies/{company_id}/tool-categories/{category_id}/update', {
                  params: { path: { ...c.path, category_id: cat.id } },
                  body: { expected_revision: cat.revision, name: text(f, 'name'), archived: f.get('archive') === 'on' },
                })
              }
            >
              <Field label="Category name" name="name" defaultValue={cat.name} required maxLength={120} />
              <label className="check">
                <input type="checkbox" name="archive" defaultChecked={!!cat.archived_at} /> Archived
              </label>
            </Form>
          </details>
        ))}
      </Section>
      <Section title="Models">
        {models.data?.map((m) => (
          <details key={m.id}>
            <summary>
              {m.manufacturer} · {m.name} · {m.model_number}
            </summary>
            <Form
              label="Save model"
              submit={(f) =>
                api.POST('/api/companies/{company_id}/tool-models/{model_id}/update', {
                  params: { path: { ...c.path, model_id: m.id } },
                  body: {
                    expected_revision: m.revision,
                    category_id: text(f, 'category'),
                    name: text(f, 'name'),
                    manufacturer: text(f, 'manufacturer'),
                    model_number: text(f, 'number'),
                    archived: f.get('archive') === 'on',
                  },
                })
              }
            >
              <Select label="Category" name="category" defaultValue={m.category_id}>
                {categories.data?.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </Select>
              <Field label="Tool name" name="name" defaultValue={m.name} required maxLength={200} />
              <Field label="Manufacturer" name="manufacturer" defaultValue={m.manufacturer} required maxLength={120} />
              <Field label="Model number" name="number" defaultValue={m.model_number} required maxLength={120} />
              <label className="check">
                <input type="checkbox" name="archive" defaultChecked={!!m.archived_at} /> Archived
              </label>
            </Form>
          </details>
        ))}
      </Section>
    </>
  );
}
