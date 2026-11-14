import { Check, Minus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { capabilityRows, LOCKED_RULES } from './access-capabilities';
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
  Section,
  SurfaceCard,
} from './kit';
import { ROLE_LABELS, ROLE_SHORT, ROLES } from './people-roles';
import { BackLink } from './related-links';
import { CommandError, CommandForm } from './settings-command';
import { Field, text } from './ui';
import { WarehouseAuthority } from './warehouse-authority';
import { useAccessDirectory, useWarehouseDirectory, type WarehouseDirectory } from './workspace-pages-state';
import './experience/access-matrix.css';

type Warehouse = Model<'WarehouseView'>;

function managerSummary(warehouse: Warehouse) {
  if (!warehouse.managers.length) return 'Equipment managers';
  const [first, ...rest] = warehouse.managers;
  return rest.length ? `${first.name} +${rest.length}` : first.name;
}

export function WarehousesPage() {
  const state = useWarehouseDirectory();
  const { c, warehouses, rows, selected, creating, archived } = state;
  const manages = c.can('warehouses.manage');
  if (warehouses.isPending && !warehouses.data) return <LoadingState label="Loading warehouses…" />;
  if (!warehouses.data)
    return (
      <ErrorState message="The warehouse directory could not be loaded." onRetry={() => void warehouses.refetch()} />
    );
  return (
    <div className="page-content">
      <PageHeading
        title="Warehouses"
        action={manages ? <Button onClick={() => state.select('new')}>Add warehouse</Button> : undefined}
      />
      {warehouses.isError && (
        <ErrorState
          message="The warehouse directory could not be refreshed."
          onRetry={() => void warehouses.refetch()}
        />
      )}
      {state.assets.isError && (
        <ErrorState message="Custody counts could not be loaded." onRetry={() => void state.assets.refetch()} />
      )}
      <DirectoryToolbar
        searchLabel="Search warehouses"
        searchPlaceholder="Search warehouses…"
        search={state.search}
        onSearchChange={state.setSearch}
      />
      <ArchivableList archived={archived} noun="warehouses" onArchivedChange={state.setArchived}>
        <RecordList
          label={archived ? 'Archived warehouses' : 'Warehouses'}
          items={rows.map((warehouse) => {
            const custody = state.custody(warehouse.id);
            return {
              id: warehouse.id,
              title: warehouse.name,
              detail: warehouse.address,
              meta: [managerSummary(warehouse), custody && `${custody.stock} in stock · ${custody.out} out`]
                .filter(Boolean)
                .join(' · '),
              label: `Open ${warehouse.name}`,
            };
          })}
          empty={
            warehouses.data.length
              ? 'No warehouses match this search.'
              : archived
                ? 'No archived warehouses.'
                : 'No warehouses are configured.'
          }
          onSelect={state.select}
        />
      </ArchivableList>
      {manages && creating && <WarehouseDialog state={state} />}
      {selected && !state.confirmingArchive && <WarehouseDialog key={selected.id} warehouse={selected} state={state} />}
      {selected && state.confirmingArchive && <ArchiveWarehouseDialog warehouse={selected} state={state} />}
    </div>
  );
}

function WarehouseDialog({ warehouse, state }: { warehouse?: Warehouse; state: WarehouseDirectory }) {
  const { c } = state;
  const manages = c.can('warehouses.manage');
  const close = () => state.select('');
  return (
    <OverlayDialog
      label={warehouse ? 'Edit warehouse' : 'Create warehouse'}
      onClose={close}
      panelClassName="admin-dialog"
      showCloseButton
      page={!!warehouse}
    >
      <div className="dialog-heading">
        <h2>{warehouse ? (manages ? 'Edit warehouse' : warehouse.name) : 'Add a warehouse'}</h2>
      </div>
      {manages && (
        <CommandForm
          label="Save warehouse"
          onCancel={close}
          onDone={close}
          submit={(form) =>
            warehouse
              ? api.POST('/api/companies/{company_id}/warehouses/{warehouse_id}/update', {
                  params: { path: { ...c.path, warehouse_id: warehouse.id } },
                  body: {
                    expected_revision: warehouse.revision,
                    name: text(form, 'name'),
                    address: text(form, 'address'),
                    archived: Boolean(warehouse.archived_at),
                  },
                })
              : api.POST('/api/companies/{company_id}/warehouses', {
                  params: { path: c.path },
                  body: { name: text(form, 'name'), address: text(form, 'address') },
                })
          }
        >
          <FieldGroup>
            <Field label="Name" name="name" defaultValue={warehouse?.name} required maxLength={200} />
            <Field label="Address" name="address" defaultValue={warehouse?.address} maxLength={2000} />
          </FieldGroup>
        </CommandForm>
      )}
      {warehouse && !manages && (
        <div className="admin-detail-list">
          <span className="eyebrow">Address</span>
          <span>{warehouse.address || 'No address recorded.'}</span>
        </div>
      )}
      {warehouse && <WarehouseAuthority warehouse={warehouse} />}
      {warehouse && manages && (
        <div className="admin-danger-zone">
          <span className="eyebrow">Warehouse status</span>
          {warehouse.archived_at ? (
            <Button
              variant="secondary"
              disabled={state.archive.busy}
              onClick={() => state.setWarehouseArchived(warehouse, false)}
            >
              {state.archive.busy ? 'Restoring…' : 'Restore warehouse'}
            </Button>
          ) : (
            <Button variant="secondary" onClick={state.startArchive}>
              Archive warehouse
            </Button>
          )}
          <CommandError error={state.archive.error} />
        </div>
      )}
      {warehouse && c.can('tools.read') && (
        <Link className="text-link" to={`/app/tools?warehouse=${warehouse.id}`}>
          View inventory
        </Link>
      )}
    </OverlayDialog>
  );
}

function ArchiveWarehouseDialog({ warehouse, state }: { warehouse: Warehouse; state: WarehouseDirectory }) {
  const { archive } = state;
  return (
    <OverlayDialog
      label="Archive warehouse"
      onClose={() => !archive.busy && state.cancelArchive()}
      panelClassName="admin-dialog"
      showCloseButton
    >
      <div className="dialog-heading">
        <h2>Archive {warehouse.name}?</h2>
        <p>Archived warehouses stay in custody history. Restore it to receive stock or add managers again.</p>
      </div>
      <CommandError error={archive.error} />
      <div className="dialog-actions">
        <Button variant="ghost" onClick={state.cancelArchive} disabled={archive.busy}>
          Cancel
        </Button>
        <Button variant="danger" onClick={() => state.setWarehouseArchived(warehouse, true)} disabled={archive.busy}>
          {archive.busy ? 'Archiving…' : 'Archive warehouse'}
        </Button>
      </div>
    </OverlayDialog>
  );
}

export function AccessPage() {
  const { access } = useAccessDirectory();
  if (access.isPending && !access.data) return <LoadingState label="Loading permissions…" />;
  if (!access.data)
    return <ErrorState message="The permission matrix could not be loaded." onRetry={() => void access.refetch()} />;
  const known = new Set<string>(ROLES);
  const roles = [
    ...ROLES.map((role) => access.data.find((entry) => entry.role === role)).filter((entry) => entry !== undefined),
    ...access.data.filter((entry) => !known.has(entry.role)),
  ];
  const label = (role: string) => (ROLE_LABELS as Record<string, string>)[role] ?? role;
  const short = (role: string) => (ROLE_SHORT as Record<string, string>)[role] ?? role.slice(0, 1).toUpperCase();
  const rows = capabilityRows(roles.flatMap((role) => role.capabilities));
  return (
    <div className="page-content">
      <BackLink to="/app/people">People</BackLink>
      <PageHeading title="Access guide" />
      {access.isError && (
        <ErrorState message="The permission matrix could not be refreshed." onRetry={() => void access.refetch()} />
      )}
      <Section title="What each role can do">
        <SurfaceCard className="permission-matrix-card">
          <div className="permission-matrix access-matrix" role="table" aria-label="Role access matrix">
            <div className="permission-matrix__row permission-matrix__header" role="row">
              <span role="columnheader">Capability</span>
              {roles.map((role) => (
                <span role="columnheader" title={label(role.role)} key={role.role}>
                  <span className="permission-role-full">{label(role.role)}</span>
                  <span className="permission-role-short" aria-hidden="true">
                    {short(role.role)}
                  </span>
                </span>
              ))}
            </div>
            {rows.map((row) => (
              <div className="permission-matrix__row" role="row" key={row.capability}>
                <span role="rowheader">
                  <strong>{row.label}</strong>
                  {row.description && <small>{row.description}</small>}
                </span>
                {roles.map((role) => {
                  const granted = role.capabilities.includes(row.capability);
                  return (
                    <span
                      className={granted ? 'permission-cell permission-cell--granted' : 'permission-cell'}
                      role="cell"
                      aria-label={`${label(role.role)}: ${granted ? 'Allowed' : 'Not allowed'}`}
                      key={role.role}
                    >
                      {granted ? <Check aria-hidden="true" /> : <Minus aria-hidden="true" />}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </SurfaceCard>
        <p className="permission-legend">
          {roles.map((role) => `${short(role.role)} · ${label(role.role)}`).join('   ')}
        </p>
      </Section>
      <Section title="Locked rules" description="These hold for every role and can't be changed.">
        <SurfaceCard className="permission-rules-card">
          <ul className="permission-rules-list" aria-label="Locked structural rules">
            {LOCKED_RULES.map((rule) => (
              <li key={rule.id}>
                <strong>{rule.label}</strong>
                <p>{rule.description}</p>
              </li>
            ))}
          </ul>
        </SurfaceCard>
      </Section>
    </div>
  );
}
