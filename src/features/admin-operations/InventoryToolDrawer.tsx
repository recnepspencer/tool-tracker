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
}: {
  item: WarehouseInventoryItemView;
  busy: boolean;
  onClose(): void;
  onEdit(): void;
  onFlag(): void;
  onRestore(): void;
  onForceReturn(): void;
  onDecommission(): void;
}) {
  const detail = useToolDetail(item.toolUnitId);
  const policy = warehouseToolDecisionPolicy({ ...item, holder: toHolderRef(item.holder) });
  const warehouseHeld = item.holder.type === 'warehouse';

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
          <span>{warehouseHeld ? 'In stock at' : 'Checked out to'}</span>
          <strong>{item.holder.name}</strong>
        </section>

        <div className="inventory-drawer__actions">
          <div>
            <Button variant="secondary" disabled={busy || !policy.canEdit} onClick={onEdit}>
              Edit
            </Button>
            {policy.canRestore ? (
              <Button disabled={busy} onClick={onRestore}>
                Restore to stock
              </Button>
            ) : policy.canForceReturn ? (
              <Button disabled={busy} onClick={onForceReturn}>
                Force return
              </Button>
            ) : (
              <Button disabled={busy || !policy.canFlag} onClick={onFlag}>
                Mark damaged
              </Button>
            )}
          </div>
          <button type="button" disabled={busy || !policy.canDecommission} onClick={onDecommission}>
            Decommission tool
          </button>
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
