import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { errorMessage, type Model } from './client';
import { Callout, cx, ErrorState, LoadingState, OverlayDialog, StatusBadge, ToolPhoto } from './kit';
import { assetLabel, photoSrc, toolStatus } from './tool-status';
import { CustodyTimeline, ToolReports } from './tool-history';
import { ToolFacts, custodianName, custodyCaveat } from './tool-detail-facts';
import { WorkerActionPanel, WorkerToolActions, WorkerToolNotices } from './tool-actions';
import { ToolDrawerActions, ToolDrawerDialog } from './tool-management';
import { toolPermissions, useToolDetailState, type ToolDetailState } from './tools-state';
import './experience/tool-detail-live.css';

/** Route-driven tool detail: the worker bottom sheet in field contexts, the inventory drawer in the control room. */
export function ToolSheet() {
  const state = useToolDetailState();
  return createPortal(state.control ? <ToolDrawer state={state} /> : <WorkerToolSheet state={state} />, document.body);
}

/** The demo's WorkerToolDetailSheet. */
function WorkerToolSheet({ state }: { state: ToolDetailState }) {
  const { tool, action, close } = state;
  return (
    <OverlayDialog
      label="Tool details"
      onClose={close}
      backdropClassName="worker-sheet-backdrop"
      panelClassName={cx('worker-bottom-sheet worker-detail-sheet', action && 'worker-detail-sheet--action')}
    >
      <span className="worker-sheet-handle" />
      <div className="detail-sheet-header">
        <span className="eyebrow">Tool details</span>
        <button type="button" className="icon-button" aria-label="Close tool details" onClick={close}>
          ×
        </button>
      </div>
      {tool.isPending ? (
        <LoadingState label="Loading tool details…" />
      ) : tool.error ? (
        <ErrorState message={errorMessage(tool.error)} onRetry={() => void tool.refetch()} />
      ) : (
        <WorkerToolContent state={state} asset={tool.data} />
      )}
    </OverlayDialog>
  );
}

function WorkerToolContent({ state, asset: t }: { state: ToolDetailState; asset: Model<'AssetView'> }) {
  const { c, action, setAction } = state;
  const permissions = toolPermissions(state, t);
  return (
    <div className="detail-sheet-content worker-detail-content" data-overlay-scroll>
      <div className="detail-hero">
        <ToolPhoto
          src={photoSrc(c.company_id, t.registration_photo_id)}
          alt={`${t.name} product photo`}
          size="large"
          priority
        />
        <div>
          <h2>{t.name}</h2>
          <p>
            {t.manufacturer} · {t.model_number}
          </p>
          <StatusBadge tone={toolStatus(t)}>{assetLabel(t)}</StatusBadge>
        </div>
      </div>
      <WorkerToolNotices state={state} asset={t} />
      {action ? (
        <WorkerActionPanel state={state} asset={t} permissions={permissions} />
      ) : (
        <WorkerToolActions state={state} asset={t} permissions={permissions} />
      )}
      <ToolFacts asset={t} companyId={c.company_id} className="detail-facts" />
      <ToolReports state={state} manages={permissions.manages} onMarkFound={(id) => setAction(`found:${id}`)} />
      <CustodyTimeline state={state} />
    </div>
  );
}

/** The demo's InventoryToolDrawer, with each management command stacked over it as a dialog. */
function ToolDrawer({ state }: { state: ToolDetailState }) {
  const { tool, close } = state;
  const t = tool.data;
  return (
    <>
      <OverlayDialog
        label={t ? `${t.name} details` : 'Tool details'}
        onClose={close}
        backdropClassName="inventory-drawer-backdrop"
        panelClassName="inventory-drawer"
        showCloseButton
        closeLabel="Close tool details"
      >
        <header className="inventory-drawer__header">
          <span>{t?.asset_tag ?? 'Tool details'}</span>
        </header>
        <div className="inventory-drawer__scroll" data-overlay-scroll>
          {tool.isPending ? (
            <LoadingState label="Loading tool details…" />
          ) : tool.error ? (
            <ErrorState message={errorMessage(tool.error)} onRetry={() => void tool.refetch()} />
          ) : (
            <DrawerContent state={state} asset={tool.data} />
          )}
        </div>
      </OverlayDialog>
      {t && <ToolDrawerDialog state={state} asset={t} permissions={toolPermissions(state, t)} />}
    </>
  );
}

function DrawerContent({ state, asset: t }: { state: ToolDetailState; asset: Model<'AssetView'> }) {
  const { c, pendingHandoff, assetRequests, setAction } = state;
  const permissions = toolPermissions(state, t);
  const caveat = custodyCaveat(t);
  const pendingRequest = assetRequests.data?.find((request) => request.status === 'pending');
  return (
    <>
      <ToolPhoto
        src={photoSrc(c.company_id, t.registration_photo_id)}
        alt={`${t.name} product photo`}
        size="large"
        priority
      />
      <div className="inventory-drawer__identity">
        <h2>{t.name}</h2>
        <p>{[t.manufacturer, t.model_number, t.category_name].filter(Boolean).join(' · ')}</p>
        <StatusBadge tone={toolStatus(t)}>{assetLabel(t)}</StatusBadge>
      </div>

      <section className="inventory-drawer__holder" aria-label="Current custody">
        <span>{t.holder_membership_id ? 'Checked out to' : 'Warehouse custody'}</span>
        <strong>{custodianName(t)}</strong>
        {caveat && <small>{caveat}</small>}
      </section>
      {t.pending_handoff_id ? (
        <section className="inventory-drawer__pending" aria-label="Pending handoff">
          <strong>In transfer</strong>
          <p>
            {pendingHandoff
              ? `Waiting for ${pendingHandoff.destination_name} to accept.`
              : 'Custody stays with the current holder until receipt is accepted.'}
          </p>
          <Link to={`/app/operations?review=handoff:${t.pending_handoff_id}`}>Review in queue</Link>
        </section>
      ) : pendingRequest ? (
        <section className="inventory-drawer__pending" aria-label="Pending request">
          <strong>Checkout requested</strong>
          <p>Requested by {pendingRequest.requester_name}. Awaiting warehouse release.</p>
          <Link to={`/app/operations?review=request:${pendingRequest.id}`}>Review in queue</Link>
        </section>
      ) : null}
      {t.lifecycle === 'disposed' && (
        <Callout
          tone="amber"
          eyebrow="Disposed"
          title="Disposal is permanent"
          description="This tool cannot be restored. Its custody and audit history stay on record."
        />
      )}

      <ToolDrawerActions state={state} asset={t} permissions={permissions} />
      <ToolFacts asset={t} companyId={c.company_id} className="inventory-drawer__facts" custody={false} />
      <ToolReports state={state} manages={permissions.manages} onMarkFound={(id) => setAction(`found:${id}`)} />
      <CustodyTimeline state={state} />
    </>
  );
}
