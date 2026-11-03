import { useQueryClient } from '@tanstack/react-query';
import { api, type Model } from './client';
import { usePeople } from './data';
import { initials } from './format';
import { Avatar, Button, SelectField } from './kit';
import { useCompany } from './session';
import { CommandError, CommandForm } from './settings-command';
import { useCommand } from './settings-command-state';
import { text } from './ui';
import './experience/warehouse-managers.css';

/** Scoped warehouse grants as the demo's manager detail list inside the warehouse dialog. */
export function WarehouseAuthority({ warehouse }: { warehouse: Model<'WarehouseView'> }) {
  const c = useCompany();
  const people = usePeople({ enabled: c.can('people.manage') });
  const cache = useQueryClient();
  const remove = useCommand();
  if (!c.can('people.manage')) return null;
  const refresh = () => void cache.invalidateQueries({ queryKey: ['session'] });
  const authority = (membershipId: string, enabled: boolean) =>
    api.POST('/api/companies/{company_id}/warehouses/{warehouse_id}/authority', {
      params: { path: { ...c.path, warehouse_id: warehouse.id } },
      body: { expected_revision: warehouse.revision, membership_id: membershipId, enabled },
    });
  const title = (membershipId: string) => people.data?.find((person) => person.id === membershipId)?.title;
  const candidates = (people.data ?? []).filter(
    (person) =>
      person.capabilities.includes('tools.transfer') &&
      !warehouse.managers.some((manager) => manager.membership_id === person.id),
  );
  return (
    <div className="admin-detail-list" role="group" aria-label="Managers">
      <span className="eyebrow">Managers</span>
      {warehouse.managers.map((manager) => (
        <article className="warehouse-manager" key={manager.membership_id} aria-label={manager.name}>
          <div className="warehouse-manager__person">
            <Avatar initials={initials(manager.name)} size="small" tone={manager.eligible ? 'blue' : 'neutral'} />
            <div>
              <strong>{manager.name}</strong>
              <small>
                {manager.eligible
                  ? title(manager.membership_id) || 'Warehouse manager'
                  : 'Grant retained; equipment access is currently inactive.'}
              </small>
            </div>
          </div>
          <div className="warehouse-manager__actions">
            {!manager.eligible && <span className="lifecycle-pill lifecycle-pill--suspended">Inactive</span>}
            <Button
              variant="ghost"
              disabled={remove.busy}
              aria-label={`Remove ${manager.name}`}
              onClick={() => void remove.run(() => authority(manager.membership_id, false), refresh)}
            >
              Remove
            </Button>
          </div>
        </article>
      ))}
      {!warehouse.managers.length && (
        <span>No warehouse managers yet. Company equipment managers already manage every warehouse.</span>
      )}
      <CommandError error={remove.error} />
      {warehouse.archived_at ? (
        <span>Restore this warehouse before adding managers.</span>
      ) : (
        <CommandForm
          label="Add manager"
          busyLabel="Adding…"
          variant="secondary"
          onDone={refresh}
          submit={(form) => {
            const membershipId = text(form, 'person');
            if (!membershipId) return Promise.reject(new Error('Choose a manager.'));
            return authority(membershipId, true);
          }}
        >
          <SelectField
            label="Manager"
            name="person"
            required
            placeholder="Choose a manager"
            emptyMessage="No eligible people"
            options={candidates.map((person) => ({
              value: person.id,
              label: person.preferred_name,
              description: person.title || undefined,
            }))}
          />
        </CommandForm>
      )}
    </div>
  );
}
