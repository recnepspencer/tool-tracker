import { useQueryClient } from '@tanstack/react-query';
import { api, type Model } from './client';
import { useReferences } from './data';
import { useCompany } from './session';
import { Empty, Form, Notice, Section, Select, text } from './ui';

export function WarehouseAuthority({ warehouse }: { warehouse: Model<'WarehouseView'> }) {
  const c = useCompany();
  const refs = useReferences();
  const cache = useQueryClient();
  if (!c.can('people.manage')) return null;
  const refresh = () => {
    void cache.invalidateQueries({ queryKey: ['session'] });
  };
  return (
    <Section title="Management authority">
      <p className="muted">Scoped warehouse grants. Company equipment managers already manage every warehouse.</p>
      {warehouse.managers.map((manager) => (
        <article className="row" key={manager.membership_id}>
          <div>
            <strong>{manager.name}</strong>
            {!manager.eligible && <p className="muted">Grant retained; equipment access is currently inactive.</p>}
          </div>
          <Form
            label={`Revoke ${manager.name}'s warehouse access`}
            onDone={refresh}
            submit={() =>
              api.POST('/api/companies/{company_id}/warehouses/{warehouse_id}/authority', {
                params: { path: { ...c.path, warehouse_id: warehouse.id } },
                body: { expected_revision: warehouse.revision, membership_id: manager.membership_id, enabled: false },
              })
            }
          >
            <></>
          </Form>
        </article>
      ))}
      {warehouse.managers.length === 0 && <Empty>No scoped managers.</Empty>}
      {warehouse.archived_at ? (
        <Notice>Restore this warehouse before granting new authority.</Notice>
      ) : (
        <Form
          label="Grant warehouse authority"
          onDone={refresh}
          submit={(f) =>
            api.POST('/api/companies/{company_id}/warehouses/{warehouse_id}/authority', {
              params: { path: { ...c.path, warehouse_id: warehouse.id } },
              body: { expected_revision: warehouse.revision, membership_id: text(f, 'person'), enabled: true },
            })
          }
        >
          <Select label="Person" name="person">
            <option value="">Choose an equipment member</option>
            {refs.people.data
              ?.filter(
                (person) =>
                  person.capabilities.includes('tools.transfer') &&
                  !warehouse.managers.some((manager) => manager.membership_id === person.id),
              )
              .map((person) => (
                <option value={person.id} key={person.id}>
                  {person.preferred_name}
                </option>
              ))}
          </Select>
        </Form>
      )}
    </Section>
  );
}
