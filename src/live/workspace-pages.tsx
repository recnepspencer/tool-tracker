import { Check, Minus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { capabilityRows, LOCKED_RULES } from './access-capabilities';
import { api, type Model } from './client';
import { Button, DirectoryToolbar, ErrorState, LoadingState, OverlayDialog, PageHeading, SurfaceCard } from './kit';
import { ROLE_LABELS, ROLE_SHORT, ROLES } from './people-roles';
import { CommandError, CommandForm } from './settings-command';
import { Field, text } from './ui';
import { WarehouseAuthority } from './warehouse-authority';
import { useAccessDirectory, useWarehouseDirectory, type WarehouseDirectory } from './workspace-pages-state';
import './experience/access-matrix.css';

type Warehouse = Model<'WarehouseView'>;
type WarehouseTab = 'active' | 'archived';

const WAREHOUSE_TABS: { value: WarehouseTab; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

function managerSummary(warehouse: Warehouse) {
  if (!warehouse.managers.length) return { name: 'Equipment managers', detail: 'Company-wide' };
  const [first, ...rest] = warehouse.managers;
  return {
    name: rest.length ? `${first.name} +${rest.length}` : first.name,
    detail: rest.length ? `${warehouse.managers.length} warehouse managers` : 'Warehouse manager',
  };
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
        eyebrow="Admin view · Warehouses"
        title="Warehouses"
        description="Manage custody locations and the people responsible for them."
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
      <DirectoryToolbar<WarehouseTab>
        searchLabel="Search warehouses"
        searchPlaceholder="Search warehouses…"
        search={state.search}
        onSearchChange={state.setSearch}
        filterLabel="Warehouse status"
        filters={WAREHOUSE_TABS}
        activeFilter={archived ? 'archived' : 'active'}
        onFilterChange={(value) => state.setArchived(value === 'archived')}
      />
      <SurfaceCard className="admin-table-card">
        <div className="admin-table-wrap">
          <table className="admin-table admin-table--responsive directory-table warehouses-table">
            <thead>
              <tr>
                <th>Warehouse</th>
                <th>Manager</th>
                <th>Status</th>
                <th>Custody</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((warehouse) => {
                const manager = managerSummary(warehouse);
                const custody = state.custody(warehouse.id);
                const counts = custody ? `${custody.stock} in stock · ${custody.out} checked out` : '';
                return (
                  <tr key={warehouse.id}>
                    <td data-label="Warehouse">
                      <button className="admin-record-button" type="button" onClick={() => state.select(warehouse.id)}>
                        {warehouse.name}
                      </button>
                      <span>{[warehouse.code, warehouse.address].filter(Boolean).join(' · ')}</span>
                      <span className="warehouses-table__mobile-meta">
                        {manager.name}
                        {counts ? ` · ${counts}` : ''}
                      </span>
                    </td>
                    <td className="directory-table__mobile-hide" data-label="Manager">
                      {manager.name}
                      <span>{manager.detail}</span>
                    </td>
                    <td className="directory-table__status" data-label="Status">
                      {warehouse.archived_at ? (
                        <span className="lifecycle-pill lifecycle-pill--removed">Archived</span>
                      ) : (
                        <span className="lifecycle-pill lifecycle-pill--active">Active</span>
                      )}
                    </td>
                    <td className="directory-table__mobile-hide" data-label="Custody">
                      {custody ? (
                        <>
                          {custody.stock} in stock
                          <span>{custody.out} checked out</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="directory-table__actions" data-label="Actions">
                      <Button
                        variant="ghost"
                        onClick={() => state.select(warehouse.id)}
                        aria-label={`Open ${warehouse.name}`}
                      >
                        Open
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <p className="admin-empty">
            {warehouses.data.length
              ? 'No warehouses match this search.'
              : archived
                ? 'No archived warehouses.'
                : 'No warehouses are configured.'}
          </p>
        )}
      </SurfaceCard>
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
    >
      <div className="dialog-heading">
        <span className="eyebrow">Warehouses</span>
        <h2>{warehouse ? (manages ? 'Edit warehouse' : warehouse.name) : 'Add a warehouse'}</h2>
        {warehouse && <p>{warehouse.code}</p>}
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
                  body: { code: text(form, 'code'), name: text(form, 'name'), address: text(form, 'address') },
                })
          }
        >
          {!warehouse && <Field label="Code" name="code" required maxLength={40} />}
          <Field label="Name" name="name" defaultValue={warehouse?.name} required maxLength={200} />
          <Field label="Address" name="address" defaultValue={warehouse?.address} maxLength={2000} />
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
        <span className="eyebrow">Warehouses</span>
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
      <PageHeading
        eyebrow="Admin view · Permissions"
        title="Access guide"
        description="See what each role can do in this workspace. Access changes are managed from People."
        action={
          <Link className="button button--secondary" to="/app/people">
            Manage people
          </Link>
        }
      />
      {access.isError && (
        <ErrorState message="The permission matrix could not be refreshed." onRetry={() => void access.refetch()} />
      )}
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
      <SurfaceCard className="permission-rules-card">
        <div className="permission-rules-heading">
          <div>
            <span className="eyebrow">Structural policy</span>
            <h2>Locked rules</h2>
          </div>
        </div>
        <ul className="permission-rules-list" aria-label="Locked structural rules">
          {LOCKED_RULES.map((rule) => (
            <li key={rule.id}>
              <strong>{rule.label}</strong>
              <p>{rule.description}</p>
            </li>
          ))}
        </ul>
      </SurfaceCard>
    </div>
  );
}
