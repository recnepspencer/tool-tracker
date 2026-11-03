import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api, type Model } from './client';
import { Button, ErrorState, LoadingState, SelectField } from './kit';
import { CustodyEvidenceFields } from './photos';
import { useStagedPhoto } from './photo-state';
import { CommandForm } from './tool-detail-form';
import { transferCandidates, type ToolDetailState, type ToolPermissions } from './tools-state';
import { selectedTransferTarget, TransferDestinationPicker, type TransferTarget } from './transfer-picker';
import { text } from './ui';

type Props = { state: ToolDetailState; asset: Model<'AssetView'>; permissions: ToolPermissions };

/** Where a request is sent: the warehouse holding the unit, as the demo's "Request from X". */
const requestSource = (t: Model<'AssetView'>) => t.warehouse_name ?? t.holder_name ?? 'the warehouse';

export const transferSubmitNote = (target: TransferTarget) =>
  target.kind === 'warehouse'
    ? 'The warehouse manager accepts the return before it goes back in stock.'
    : 'The tool stays in your custody until they accept.';

export function proposeHandoff(state: ToolDetailState, t: Model<'AssetView'>, form: FormData, photoId: string | null) {
  const [kind, id] = text(form, 'destination').split(':');
  return api.POST('/api/companies/{company_id}/tools/{asset_id}/handoffs', {
    params: { path: state.path },
    body: {
      request_key: state.key,
      expected_revision: t.revision,
      destination_membership_id: kind === 'person' ? id : null,
      destination_warehouse_id: kind === 'warehouse' ? id : null,
      note: text(form, 'note'),
      photo_id: photoId,
    },
  });
}

export function markFound(state: ToolDetailState, incident: Model<'IncidentView'>, form: FormData) {
  return api.POST('/api/companies/{company_id}/incidents/{incident_id}/found', {
    params: { path: { ...state.c.path, incident_id: incident.id } },
    body: { expected_revision: incident.revision, note: text(form, 'note') },
  });
}

/** The demo's custody action buttons for the field tool sheet. */
export function WorkerToolActions({ state, asset: t, permissions: p }: Props) {
  const { tool, incidents, requests, setAction } = state;
  const ownRequest = requests.data?.[0];
  const canRequest = p.request && t.requestable && !ownRequest && !t.pending_handoff_id;
  const canTransfer = p.transfer && !t.pending_handoff_id;
  const reportBusy = tool.isFetching || incidents.isPending || incidents.isFetching;
  const reportDamage = p.report && !p.damageOpen;
  const reportLoss = p.report && !p.missingOpen;
  if (!canRequest && !canTransfer && !reportDamage && !reportLoss) return null;
  return (
    <section className="detail-actions" aria-label="Custody actions">
      {canRequest && (
        <Button variant="primary" disabled={tool.isFetching} onClick={() => setAction('request')}>
          Request from {requestSource(t)}
        </Button>
      )}
      {canTransfer && (
        <Button variant="primary" disabled={tool.isFetching} onClick={() => setAction('transfer')}>
          Transfer tool
        </Button>
      )}
      {(reportDamage || reportLoss) && (
        <div className="detail-action-row">
          {reportDamage && (
            <Button variant="danger" disabled={reportBusy} onClick={() => setAction('damage')}>
              Report damaged
            </Button>
          )}
          {reportLoss && (
            <Button variant="danger" disabled={reportBusy} onClick={() => setAction('missing')}>
              Report lost
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function PanelHeading({ title, onClose }: { title: string; onClose(): void }) {
  return (
    <div className="detail-section-heading">
      <div>
        <span className="eyebrow">Confirm action</span>
        <h3>{title}</h3>
      </div>
      <button type="button" className="text-button" onClick={onClose}>
        Close
      </button>
    </div>
  );
}

/** A panel that cannot offer its form right now explains why, under the same heading. */
function PanelMessage({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  return (
    <section className="detail-action-panel" aria-label="Action details">
      <PanelHeading title={title} onClose={onClose} />
      {children}
    </section>
  );
}

const actionTitles: Record<string, (t: Model<'AssetView'>) => string> = {
  request: (t) => `Request from ${requestSource(t)}`,
  transfer: () => 'Transfer',
  damage: () => 'Report damage',
  missing: () => 'Report loss',
  found: () => 'Mark found',
};

/** The demo's `detail-action-panel` for the action chosen in the sheet. */
export function WorkerActionPanel({ state, asset: t, permissions: p }: Props) {
  const { action, setAction, requests, incidents, refs, c } = state;
  const kind = action.startsWith('found:') ? 'found' : action;
  const title = actionTitles[kind]?.(t) ?? 'Confirm action';
  const close = () => setAction('');
  const message = (content: ReactNode) => (
    <PanelMessage title={title} onClose={close}>
      {content}
    </PanelMessage>
  );
  if (kind === 'request') {
    if (requests.isPending) return message(<LoadingState label="Checking your requests…" />);
    if (requests.error) return message(<ErrorState message="Your requests could not be loaded." />);
    if (requests.data?.length)
      return message(
        <p className="detail-action-notice">You already requested this tool. It is waiting for review.</p>,
      );
    if (!t.requestable || !c.can('tools.request'))
      return message(<p className="detail-action-error">This tool is not currently available to request.</p>);
    return <RequestPanel state={state} asset={t} permissions={p} title={title} />;
  }
  if (kind === 'transfer') {
    if (!p.transfer)
      return message(
        <p className="detail-action-error">
          You must be the holder or manage the source warehouse to transfer this tool.
        </p>,
      );
    if (t.pending_handoff_id)
      return message(<p className="detail-action-error">This tool already has a transfer waiting to be accepted.</p>);
    if (refs.people.isPending || refs.warehouses.isPending)
      return message(<LoadingState label="Loading transfer targets…" />);
    if (refs.people.error || refs.warehouses.error)
      return message(<ErrorState message="Transfer targets could not be loaded." />);
    return <TransferPanel state={state} asset={t} permissions={p} title={title} />;
  }
  if (kind === 'damage' || kind === 'missing') {
    if (!p.report)
      return message(
        <p className="detail-action-error">Only the holder or responsible manager may report this tool.</p>,
      );
    if (incidents.isPending) return message(<LoadingState />);
    if (kind === 'damage' ? p.damageOpen : p.missingOpen)
      return message(<p className="detail-action-notice">This problem is already reported.</p>);
    return <ReportPanel state={state} asset={t} permissions={p} title={title} kind={kind} />;
  }
  if (kind === 'found') {
    const incident = incidents.data?.find((item) => item.id === action.slice('found:'.length) && !item.resolved_at);
    if (incidents.isPending) return message(<LoadingState />);
    if (!incident || !p.manages)
      return message(<p className="detail-action-error">This report is closed or you cannot resolve it.</p>);
    return (
      <CommandForm
        className="detail-action-panel"
        label="Action details"
        submitLabel="Mark found"
        onDone={close}
        submit={(form) => markFound(state, incident, form)}
      >
        <PanelHeading title={title} onClose={close} />
        <CustodyEvidenceFields
          className="detail-action-field"
          context="loss"
          noteLabel="Where was it found?"
          notePlaceholder="e.g. back of the service van"
          noteRequired
          showPhoto={false}
        />
      </CommandForm>
    );
  }
  return null;
}

type PanelProps = Props & { title: string };

function RequestPanel({ state, asset: t, title }: PanelProps) {
  const { path, key, renewKey, setAction, requestUnits, chooseRequestUnit } = state;
  return (
    <CommandForm
      className="detail-action-panel"
      label="Action details"
      submitLabel={title}
      onDone={() => {
        renewKey();
        setAction('');
      }}
      submit={(form) =>
        api.POST('/api/companies/{company_id}/tools/{asset_id}/requests', {
          params: { path },
          body: { request_key: key, note: text(form, 'note') },
        })
      }
    >
      <PanelHeading title={title} onClose={() => setAction('')} />
      {requestUnits.length > 1 && (
        <SelectField
          label="Warehouse"
          value={t.id}
          onChange={chooseRequestUnit}
          options={requestUnits.map((unit) => ({
            value: unit.unitId,
            label: unit.warehouseName,
          }))}
          placeholder="Choose a warehouse"
          searchable={false}
          presentation="sheet"
        />
      )}
      <CustodyEvidenceFields className="detail-action-field" context="request" showPhoto={false} />
    </CommandForm>
  );
}

function TransferPanel({ state, asset: t, title }: PanelProps) {
  const { c, key, renewKey, setAction, picker } = state;
  const photo = useStagedPhoto(c.company_id, 'handoff', key);
  const candidates = transferCandidates(state, t);
  const target = selectedTransferTarget(candidates, picker.target);
  return (
    <CommandForm
      className="detail-action-panel detail-action-panel--transfer"
      label="Action details"
      submitClassName="transfer-submit-button"
      submitLabel={target ? `Send to ${target.name}` : 'Choose a destination'}
      disabled={!target}
      after={target && <p className="transfer-submit-note">{transferSubmitNote(target)}</p>}
      onDone={() => {
        photo.clear();
        renewKey();
        setAction('');
      }}
      submit={async (form) => proposeHandoff(state, t, form, await photo.upload(form))}
    >
      <PanelHeading title={title} onClose={() => setAction('')} />
      <TransferDestinationPicker candidates={candidates} picker={picker} />
      {target && <CustodyEvidenceFields className="detail-action-field" context="transfer" />}
    </CommandForm>
  );
}

function ReportPanel({ state, asset: t, title, kind }: PanelProps & { kind: 'damage' | 'missing' }) {
  const { c, path, setAction } = state;
  const photo = useStagedPhoto(c.company_id, 'incident', t.revision);
  return (
    <CommandForm
      className="detail-action-panel"
      label="Action details"
      submitLabel={title}
      submitVariant="danger"
      onDone={() => {
        photo.clear();
        setAction('');
      }}
      submit={async (form) =>
        api.POST('/api/companies/{company_id}/tools/{asset_id}/incidents', {
          params: { path },
          body: {
            expected_revision: t.revision,
            kind,
            description: text(form, 'description'),
            photo_id: await photo.upload(form),
          },
        })
      }
    >
      <PanelHeading title={title} onClose={() => setAction('')} />
      <CustodyEvidenceFields
        className="detail-action-field"
        context={kind === 'missing' ? 'loss' : 'condition'}
        noteName="description"
        noteLabel="What happened?"
        noteRequired
      />
    </CommandForm>
  );
}

/** Status lines under the hero: a transfer in flight, the member's own request, or disposal. */
export function WorkerToolNotices({ state, asset: t }: Omit<Props, 'permissions'>) {
  const { pendingHandoff, requests } = state;
  const ownRequest = requests.data?.[0];
  return (
    <>
      {t.pending_handoff_id && (
        <p className="detail-action-notice" role="status">
          {pendingHandoff ? `In transfer to ${pendingHandoff.destination_name}. ` : 'In transfer. '}
          {pendingHandoff ? (
            <Link className="text-button" to={`/app/mine?review=handoff:${pendingHandoff.id}`}>
              Review transfer
            </Link>
          ) : (
            'Custody stays with the current holder until receipt is accepted.'
          )}
        </p>
      )}
      {ownRequest && (
        <p className="detail-action-notice" role="status">
          {ownRequest.status === 'approved'
            ? 'Request approved. Confirm receipt when you have the tool. '
            : `Requested from ${requestSource(t)}. Waiting for review. `}
          <Link className="text-button" to={`/app/mine?review=request:${ownRequest.id}`}>
            Review request
          </Link>
        </p>
      )}
      {t.lifecycle === 'disposed' && (
        <p className="detail-action-error" role="status">
          Disposal is permanent. This tool cannot be restored.
        </p>
      )}
    </>
  );
}
