import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api, type Model } from './client';
import { AssetDetailsFields, assetDetailsInput } from './asset-details';
import { Button, Callout, ErrorState, LoadingState, OverlayDialog, SelectField } from './kit';
import { CustodyEvidenceFields } from './photos';
import { useStagedPhoto } from './photo-state';
import { OpenCaseDialog } from './reconciliation-open';
import { markFound, proposeHandoff, transferSubmitNote } from './tool-actions';
import { CommandForm } from './tool-detail-form';
import { transferCandidates, useChoice, type ToolDetailState, type ToolPermissions } from './tools-state';
import { selectedTransferTarget, TransferDestinationPicker } from './transfer-picker';
import { TextArea, text } from './ui';

type Props = { state: ToolDetailState; asset: Model<'AssetView'>; permissions: ToolPermissions };

const pairs = <T,>(items: T[]) =>
  items.reduce<T[][]>(
    (rows, item, index) => (index % 2 ? rows[rows.length - 1]!.push(item) : rows.push([item]), rows),
    [],
  );

/** The demo InventoryToolDrawer action row, extended with the live management commands. */
export function ToolDrawerActions({ state, asset: t, permissions: p }: Props) {
  const { tool, incidents, setAction } = state;
  const busy = tool.isFetching;
  const transfer = p.transfer && !t.pending_handoff_id;
  const flagBusy = busy || incidents.isPending || incidents.isFetching;
  const more: { key: string; label: string }[] = [
    ...(p.restore && transfer ? [{ key: 'transfer', label: 'Transfer tool' }] : []),
    ...(p.service ? [{ key: 'service', label: 'Record service' }] : []),
    ...(p.stewardship ? [{ key: 'stewardship', label: 'Change warehouse' }] : []),
    ...(p.reconcile ? [{ key: 'reconcile', label: 'Open reconciliation case' }] : []),
  ];
  const primary = p.restore
    ? { key: 'restore', label: 'Restore to stock' }
    : transfer
      ? { key: 'transfer', label: 'Transfer tool' }
      : null;
  const flagDamage = p.report && !p.damageOpen;
  const flagLoss = p.report && !p.missingOpen;
  if (!p.edit && !primary && !flagDamage && !flagLoss && !more.length && !p.lifecycle) return null;
  return (
    <div className="inventory-drawer__actions">
      {(p.edit || primary) && (
        <div className="inventory-drawer__action-row">
          {p.edit && (
            <Button variant="secondary" disabled={busy} onClick={() => setAction('edit')}>
              Edit
            </Button>
          )}
          {primary && (
            <Button disabled={busy} onClick={() => setAction(primary.key)}>
              {primary.label}
            </Button>
          )}
        </div>
      )}
      {(flagDamage || flagLoss) && (
        <div className="inventory-drawer__action-row inventory-drawer__condition-row">
          {flagDamage && (
            <Button variant="secondary" disabled={flagBusy} onClick={() => setAction('damage')}>
              Mark damaged
            </Button>
          )}
          {flagLoss && (
            <Button variant="danger" disabled={flagBusy} onClick={() => setAction('missing')}>
              Mark lost
            </Button>
          )}
        </div>
      )}
      {pairs(more).map((row) => (
        <div className="inventory-drawer__action-row" key={row[0]!.key}>
          {row.map((item) => (
            <Button key={item.key} variant="secondary" disabled={busy} onClick={() => setAction(item.key)}>
              {item.label}
            </Button>
          ))}
        </div>
      ))}
      {p.lifecycle && (
        <button type="button" disabled={busy} onClick={() => setAction('lifecycle')}>
          {t.lifecycle === 'retired' ? 'Reinstate or dispose' : 'Decommission tool'}
        </button>
      )}
    </div>
  );
}

function DecisionDialog({
  label,
  title,
  description,
  onClose,
  children,
}: {
  label: string;
  title: string;
  description: string;
  onClose(): void;
  children: ReactNode;
}) {
  return (
    <OverlayDialog label={label} onClose={onClose} panelClassName="admin-dialog operations-dialog" showCloseButton>
      <div className="dialog-heading">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {children}
    </OverlayDialog>
  );
}

/** The management command chosen in the drawer, as its own dialog stacked over it. */
export function ToolDrawerDialog(props: Props) {
  const { state, asset: t, permissions: p } = props;
  const { action } = state;
  if (action === 'edit' && p.edit) return <EditDialog {...props} />;
  if ((action === 'damage' || action === 'missing') && p.report && !(p.damageOpen && p.missingOpen))
    return <FlagDialog {...props} initial={action} />;
  if (action === 'restore' && p.restore) return <ServiceDialog {...props} restore />;
  if (action === 'service' && p.service) return <ServiceDialog {...props} restore={false} />;
  if (action === 'lifecycle' && p.lifecycle) return <LifecycleDialog {...props} />;
  if (action === 'stewardship' && p.stewardship) return <StewardshipDialog {...props} />;
  if (action === 'reconcile' && p.reconcile) return <ReconcileDialog {...props} />;
  if (action === 'transfer' && p.transfer && !t.pending_handoff_id) return <TransferDialog {...props} />;
  if (action.startsWith('found:') && p.manages) {
    const incident = state.incidents.data?.find(
      (item) => item.id === action.slice('found:'.length) && !item.resolved_at && item.kind === 'missing',
    );
    if (incident) return <FoundDialog {...props} incident={incident} />;
  }
  return null;
}

function EditDialog({ state, asset: t }: Props) {
  const close = () => state.setAction('');
  return (
    <DecisionDialog
      label={`Edit ${t.name}`}
      title="Edit tool"
      description="Update this unit's record without changing custody or warehouse responsibility."
      onClose={close}
    >
      <CommandForm
        submitLabel="Save changes"
        onCancel={close}
        onDone={close}
        after={
          <Link className="text-link" to="/app/catalog">
            Edit name, brand, model or category in the catalog
          </Link>
        }
        submit={(form) =>
          api.POST('/api/companies/{company_id}/tools/{asset_id}/update', {
            params: { path: state.path },
            body: { expected_revision: t.revision, ...assetDetailsInput(form) },
          })
        }
      >
        <div className="operations-form">
          <AssetDetailsFields asset={t} />
        </div>
      </CommandForm>
    </DecisionDialog>
  );
}

const flagCopy = {
  damage: {
    action: 'Mark damaged',
    description: 'Record the damage against the same tool-unit history used by worker reports.',
  },
  missing: {
    action: 'Mark lost',
    description: 'Record that this tool cannot be located without removing its custody history.',
  },
};

function FlagDialog({ state, asset: t, permissions: p, initial }: Props & { initial: 'damage' | 'missing' }) {
  const available = (['damage', 'missing'] as const).filter((kind) =>
    kind === 'damage' ? !p.damageOpen : !p.missingOpen,
  );
  const [chosen, setCondition] = useChoice<'damage' | 'missing'>(available.includes(initial) ? initial : available[0]!);
  const condition = available.includes(chosen) ? chosen : available[0]!;
  const photo = useStagedPhoto(state.c.company_id, 'incident', t.revision);
  const copy = flagCopy[condition];
  const close = () => state.setAction('');
  return (
    <DecisionDialog
      label={`${copy.action}: ${t.name}`}
      title={copy.action}
      description={copy.description}
      onClose={close}
    >
      <CommandForm
        submitLabel={copy.action}
        submitVariant="danger"
        onCancel={close}
        onDone={() => {
          photo.clear();
          close();
        }}
        submit={async (form) =>
          api.POST('/api/companies/{company_id}/tools/{asset_id}/incidents', {
            params: { path: state.path },
            body: {
              expected_revision: t.revision,
              kind: condition,
              description: text(form, 'description'),
              photo_id: await photo.upload(form),
            },
          })
        }
      >
        <div className="operations-form">
          <SelectField
            label="Condition"
            value={condition}
            onChange={(value) => setCondition(value as 'damage' | 'missing')}
            options={available.map((kind) => ({ value: kind, label: kind === 'damage' ? 'Damaged' : 'Lost' }))}
            searchable={false}
          />
          <CustodyEvidenceFields
            context={condition === 'missing' ? 'loss' : 'condition'}
            noteName="description"
            noteLabel="Evidence note"
            noteRequired
          />
        </div>
      </CommandForm>
    </DecisionDialog>
  );
}

const serviceOptions = [
  { value: 'serviceable', label: 'Serviceable', description: 'Ready to check out' },
  { value: 'damaged', label: 'Damaged', description: 'Still usable with care until repaired' },
  { value: 'out_of_service', label: 'Out of service', description: 'Cannot be checked out' },
];

function ServiceDialog({ state, asset: t, restore }: Props & { restore: boolean }) {
  const photo = useStagedPhoto(state.c.company_id, 'service', t.revision);
  const close = () => state.setAction('');
  return (
    <DecisionDialog
      label={`${restore ? 'Restore' : 'Record service for'} ${t.name}`}
      title={restore ? 'Restore to stock' : 'Record service'}
      description={
        restore
          ? 'Record the repair or inspection that puts this tool back in service.'
          : "Log an inspection or repair against this unit's history."
      }
      onClose={close}
    >
      <CommandForm
        submitLabel={restore ? 'Restore to stock' : 'Save service record'}
        onCancel={close}
        onDone={() => {
          photo.clear();
          close();
        }}
        submit={async (form) =>
          api.POST('/api/companies/{company_id}/tools/{asset_id}/service', {
            params: { path: state.path },
            body: {
              expected_revision: t.revision,
              serviceability: text(form, 'serviceability') as 'serviceable' | 'damaged' | 'out_of_service',
              note: text(form, 'note'),
              photo_id: await photo.upload(form),
            },
          })
        }
      >
        <div className="operations-form">
          {restore ? (
            <input type="hidden" name="serviceability" value="serviceable" />
          ) : (
            <SelectField
              label="Condition"
              name="serviceability"
              defaultValue={t.serviceability}
              options={serviceOptions}
              searchable={false}
              required
            />
          )}
          <CustodyEvidenceFields
            context="condition"
            noteLabel="Work performed"
            notePlaceholder="e.g. replaced the trigger switch"
            noteRequired
          />
        </div>
      </CommandForm>
    </DecisionDialog>
  );
}

function LifecycleDialog({ state, asset: t }: Props) {
  const close = () => state.setAction('');
  const blocked = t.missing
    ? 'Resolve the missing-tool report before retiring or disposing of it.'
    : !t.warehouse_id
      ? 'Receive this tool at a warehouse before retiring or disposing of it.'
      : t.pending_handoff_id
        ? 'Resolve the pending handoff in the queue before retiring or disposing of this tool.'
        : null;
  const options =
    t.lifecycle === 'retired'
      ? [
          { value: 'active', label: 'Active', description: 'Return it to available inventory' },
          { value: 'disposed', label: 'Disposed', description: 'Permanent; it cannot be restored' },
        ]
      : [
          { value: 'retired', label: 'Retired', description: 'Archived with its history; can be reinstated' },
          { value: 'disposed', label: 'Disposed', description: 'Permanent; it cannot be restored' },
        ];
  const retired = t.lifecycle === 'retired';
  return (
    <DecisionDialog
      label={`${retired ? 'Change lifecycle of' : 'Decommission'} ${t.name}`}
      title={retired ? 'Change lifecycle' : 'Decommission tool'}
      description="This archives the unit while keeping its custody and audit history. Return it to a warehouse first."
      onClose={close}
    >
      {blocked ? (
        <>
          <Callout tone="amber" title="This tool cannot change lifecycle" description={blocked} />
          <div className="dialog-actions">
            <Button variant="secondary" onClick={close}>
              Close
            </Button>
          </div>
        </>
      ) : (
        <CommandForm
          submitLabel={retired ? 'Update lifecycle' : 'Decommission'}
          submitVariant="danger"
          onCancel={close}
          onDone={close}
          submit={(form) =>
            api.POST('/api/companies/{company_id}/tools/{asset_id}/lifecycle', {
              params: { path: state.path },
              body: {
                expected_revision: t.revision,
                lifecycle: text(form, 'lifecycle') as 'active' | 'retired' | 'disposed',
                note: text(form, 'note'),
              },
            })
          }
        >
          <div className="operations-form">
            <SelectField
              label="Lifecycle"
              name="lifecycle"
              defaultValue={options[0]!.value}
              options={options}
              searchable={false}
              required
            />
            <Callout
              tone="amber"
              title="Disposal cannot be undone"
              description="A disposed tool cannot be restored or reassigned. Its custody and audit history stay on record."
            />
            <TextArea label="Reason or evidence note" name="note" required maxLength={2000} rows={3} />
          </div>
        </CommandForm>
      )}
    </DecisionDialog>
  );
}

function StewardshipDialog({ state, asset: t }: Props) {
  const close = () => state.setAction('');
  const warehouses = (state.refs.warehouses.data ?? []).filter(
    (warehouse) => !warehouse.archived_at || warehouse.id === t.responsible_warehouse_id,
  );
  return (
    <DecisionDialog
      label={`Change responsible warehouse for ${t.name}`}
      title="Change responsible warehouse"
      description="Moves accountability for this tool to another warehouse. Custody does not change."
      onClose={close}
    >
      <CommandForm
        submitLabel="Change warehouse"
        onCancel={close}
        onDone={close}
        submit={(form) =>
          api.POST('/api/companies/{company_id}/tools/{asset_id}/stewardship', {
            params: { path: state.path },
            body: { expected_revision: t.revision, warehouse_id: text(form, 'warehouse'), note: text(form, 'note') },
          })
        }
      >
        <div className="operations-form">
          <SelectField
            label="Responsible warehouse"
            name="warehouse"
            defaultValue={t.responsible_warehouse_id}
            options={warehouses.map((warehouse) => ({
              value: warehouse.id,
              label: warehouse.name,
            }))}
            disabled={state.refs.warehouses.isPending}
            required
          />
          <TextArea label="Reason" name="note" required maxLength={2000} rows={3} />
        </div>
      </CommandForm>
    </DecisionDialog>
  );
}

function ReconcileDialog({ state, asset: t }: Props) {
  return <OpenCaseDialog asset={t} onClose={() => state.setAction('')} />;
}

function TransferDialog({ state, asset: t }: Props) {
  const { c, key, renewKey, picker, refs } = state;
  const photo = useStagedPhoto(c.company_id, 'handoff', key);
  const candidates = transferCandidates(state, t);
  const target = selectedTransferTarget(candidates, picker.target);
  const close = () => state.setAction('');
  const loading = refs.people.isPending || refs.warehouses.isPending;
  const failed = refs.people.error || refs.warehouses.error;
  return (
    <DecisionDialog
      label={`Transfer ${t.name}`}
      title="Transfer tool"
      description="Custody stays with the current holder until the recipient accepts."
      onClose={close}
    >
      <CommandForm
        submitLabel={target ? `Send to ${target.name}` : 'Choose a destination'}
        disabled={!target}
        onCancel={close}
        after={target && <p className="transfer-submit-note">{transferSubmitNote(target)}</p>}
        onDone={() => {
          photo.clear();
          renewKey();
          close();
        }}
        submit={async (form) => proposeHandoff(state, t, form, await photo.upload(form))}
      >
        <div className="operations-form">
          {loading ? (
            <LoadingState label="Loading transfer targets…" />
          ) : failed ? (
            <ErrorState message="Transfer targets could not be loaded." />
          ) : (
            <TransferDestinationPicker candidates={candidates} picker={picker} presentation="popover" />
          )}
          {target && <CustodyEvidenceFields context="transfer" />}
        </div>
      </CommandForm>
    </DecisionDialog>
  );
}

function FoundDialog({ state, asset: t, incident }: Props & { incident: Model<'IncidentView'> }) {
  const close = () => state.setAction('');
  return (
    <DecisionDialog
      label={`Mark ${t.name} found`}
      title="Mark found"
      description="Record where the tool turned up. This closes the missing report."
      onClose={close}
    >
      <CommandForm
        submitLabel="Mark found"
        onCancel={close}
        onDone={close}
        submit={(form) => markFound(state, incident, form)}
      >
        <div className="operations-form">
          <TextArea label="Where was it found?" name="note" required maxLength={2000} rows={3} />
        </div>
      </CommandForm>
    </DecisionDialog>
  );
}
