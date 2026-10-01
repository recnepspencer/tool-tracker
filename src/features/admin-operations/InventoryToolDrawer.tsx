import type { WarehouseInventoryItemView } from '../../domain/read-models/warehouse-operations';
import { Button } from '../../components/ui/Button';
import { ErrorState, LoadingState } from '../../components/ui/AsyncState';
import { OverlayDialog } from '../../components/ui/OverlayDialog';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ToolPhoto } from '../../components/ui/ToolPhoto';
import { warehouseToolDecisionPolicy } from '../../domain/warehouse-tool-policy';
import { CustodyTimeline } from '../tool-detail/CustodyTimeline';
import { useToolDetail } from '../tool-detail/use-tool-detail';
import { toHolderRef } from './holder-ref';
import { Link } from 'react-router-dom';
import { useSession } from '../../app/session-context';
import '../../styles/activity-indicator.css';
import '../../styles/tool-detail.css';

export function InventoryToolDrawer({
  item,
  busy,
  onClose,
  onEdit,
  onFlag,
  onRestore,
  onForceReturn,
  onDecommission,
  error,
}: {
  item: WarehouseInventoryItemView;
  busy: boolean;
  onClose(): void;
  onEdit(): void;
  onFlag(condition: 'damaged' | 'lost'): void;
  onRestore(): void;
  onForceReturn(): void;
  onDecommission(): void;
  error?: string;
}) {
  const detail = useToolDetail(item.toolUnitId);
  const policy = warehouseToolDecisionPolicy({ ...item, holder: toHolderRef(item.holder) });
  const warehouseHeld = item.holder.type === 'warehouse';
  const pending = item.pendingHandoff;
  const role = useSession().session?.role;
  const commandBlocked = busy || Boolean(pending);

  return (
    <OverlayDialog
      label={`${item.toolName} details`}
      onClose={onClose}
      backdropClassName="inventory-drawer-backdrop"
      panelClassName="inventory-drawer"
      showCloseButton
      closeLabel="Close tool details"
    >
      <header className="inventory-drawer__header">
        <span>{item.toolUnitId}</span>
      </header>
      <div className="inventory-drawer__scroll" data-overlay-scroll>
        <ToolPhoto src={item.imageSrc} alt={`${item.toolName} product photo`} size="large" priority />
        <div className="inventory-drawer__identity">
          <h2>{item.toolName}</h2>
          <p>{[item.brand, item.model, item.category].filter(Boolean).join(' · ')}</p>
          <StatusBadge status={item.status} />
        </div>

        <section className="inventory-drawer__holder" aria-label="Current custody">
          <span>{warehouseHeld ? 'Warehouse custody' : 'Checked out to'}</span>
          <strong>{item.holder.name}</strong>
        </section>
        {pending && (
          <section className="inventory-drawer__pending" aria-label="Pending handoff">
            <strong>{pending.kind === 'warehouse-request' ? 'Checkout requested' : 'In transfer'}</strong>
            <p>
              {pending.kind === 'warehouse-request'
                ? `Requested by ${pending.destination}. Awaiting warehouse release.`
                : `Waiting for ${pending.destination} to accept.`}
            </p>
            {pending.warehouseDestination || pending.kind === 'warehouse-request' ? (
              <Link
                to={role === 'warehouse-manager' ? '/warehouse/operations/queue' : '/admin/operations/queue'}
                onClick={onClose}
              >
                Review in queue
              </Link>
            ) : (
              <small>Resolve this handoff before editing or forcing a return.</small>
            )}
          </section>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="inventory-drawer__actions">
          <div className="inventory-drawer__action-row">
            <Button variant="secondary" disabled={commandBlocked || !policy.canEdit} onClick={onEdit}>
              Edit
            </Button>
            {policy.canRestore ? (
              <Button disabled={commandBlocked} onClick={onRestore}>
                Restore to stock
              </Button>
            ) : policy.canForceReturn ? (
              <Button disabled={commandBlocked} onClick={onForceReturn}>
                Force return
              </Button>
            ) : null}
          </div>
          {policy.canFlag ? (
            <div className="inventory-drawer__action-row inventory-drawer__condition-row">
              <Button variant="secondary" disabled={commandBlocked} onClick={() => onFlag('damaged')}>
                Mark damaged
              </Button>
              <Button variant="danger" disabled={commandBlocked} onClick={() => onFlag('lost')}>
                Mark lost
              </Button>
            </div>
          ) : null}
          {policy.canDecommission ? (
            <button type="button" disabled={commandBlocked} onClick={onDecommission}>
              Decommission tool
            </button>
          ) : null}
        </div>

        {detail.isPending ? <LoadingState label="Loading custody history…" /> : null}
        {detail.isError ? <ErrorState message="Custody history could not be loaded." /> : null}
        {detail.data ? (
          <>
            <dl className="inventory-drawer__facts">
              <div>
                <dt>Category</dt>
                <dd>{item.category}</dd>
              </div>
              <div>
                <dt>Home yard</dt>
                <dd>{detail.data.originWarehouse.name}</dd>
              </div>
              <div>
                <dt>Warehouse</dt>
                <dd>{item.warehouseName}</dd>
              </div>
              <div>
                <dt>Last move</dt>
                <dd>{item.lastMoved}</dd>
              </div>
              {item.serial ? (
                <div>
                  <dt>Serial</dt>
                  <dd>{item.serial}</dd>
                </div>
              ) : null}
              {item.price ? (
                <div>
                  <dt>Price</dt>
                  <dd>{item.price}</dd>
                </div>
              ) : null}
            </dl>
            <CustodyTimeline events={detail.data.timeline} />
          </>
        ) : null}
      </div>
    </OverlayDialog>
  );
}
