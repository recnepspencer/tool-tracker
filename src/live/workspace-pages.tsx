import { WarehouseAuthority } from './warehouse-authority';
import { Link } from 'react-router-dom';
import { api, errorMessage } from './client';
import { RecordSheet } from './experience/RecordSheet';
import { useAccessDirectory, useWarehouseDirectory } from './workspace-pages-state';
import { Badge, Empty, Field, Form, human, Loading, Notice, Section, text } from './ui';

export function WarehousesPage() {
  const { c, warehouses, selected, select, creating, archived, setArchived } = useWarehouseDirectory();
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>Warehouses</h1>
          <p>Locations, stock, and warehouse authority.</p>
        </div>
        <button className="button primary" onClick={() => select('new')}>
          Add warehouse
        </button>
      </header>
      {warehouses.isPending && <Loading />}
      {warehouses.error && <Notice error>{errorMessage(warehouses.error)}</Notice>}
      <label className="check">
        <input type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} />
        Show archived warehouses
      </label>
      {creating && (
        <RecordSheet title="Add warehouse" onClose={() => select('')}>
          <h1>Add warehouse</h1>
          <Form
            label="Create warehouse"
            onDone={() => select('')}
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
        </RecordSheet>
      )}
      <div className="inventory-card">
        <table className="inventory-table">
          <thead>
            <tr>
              <th>Warehouse</th>
              <th>Code</th>
              <th>Status</th>
              <th>Address</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {warehouses.data?.map((item) => (
              <tr key={item.id}>
                <td>
                  <button onClick={() => select(item.id)}>{item.name}</button>
                </td>
                <td>{item.code}</td>
                <td>
                  <Badge>{item.archived_at ? 'Archived' : 'Active'}</Badge>
                </td>
                <td>{item.address || '—'}</td>
                <td>
                  <button onClick={() => select(item.id)}>Open</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {warehouses.data?.length === 0 && <Empty>No warehouses yet.</Empty>}
      {selected && (
        <RecordSheet title="Warehouse details" onClose={() => select('')}>
          <h1>{selected.name}</h1>
          <Section title="Warehouse information">
            <Form
              label="Save warehouse"
              onDone={() => select('')}
              submit={(f) =>
                api.POST('/api/companies/{company_id}/warehouses/{warehouse_id}/update', {
                  params: { path: { ...c.path, warehouse_id: selected.id } },
                  body: {
                    expected_revision: selected.revision,
                    name: text(f, 'name'),
                    address: text(f, 'address'),
                    archived: f.get('archive') === 'on',
                  },
                })
              }
            >
              <Field name="name" label="Name" defaultValue={selected.name} required />
              <Field name="address" label="Address" defaultValue={selected.address} />
              <label className="check">
                <input type="checkbox" name="archive" defaultChecked={!!selected.archived_at} />
                Archived
              </label>
            </Form>
          </Section>
          <WarehouseAuthority warehouse={selected} />
          <Link to={`/app/tools?warehouse=${selected.id}`}>View inventory</Link>
        </RecordSheet>
      )}
    </>
  );
}
export function AccessPage() {
  const { access } = useAccessDirectory();
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>Access</h1>
          <p>Company roles and the capabilities each role grants.</p>
        </div>
        <Link className="button" to="/app/people">
          Manage people
        </Link>
      </header>
      {access.isPending && <Loading />}
      {access.error && <Notice error>{errorMessage(access.error)}</Notice>}
      {access.data?.map((role) => (
        <Section title={human(role.role)} key={role.role}>
          <div className="capability-list">
            {role.capabilities.map((capability) => (
              <span className="badge" key={capability}>
                {human(capability.replaceAll('.', ' '))}
              </span>
            ))}
          </div>
        </Section>
      ))}
    </>
  );
}
