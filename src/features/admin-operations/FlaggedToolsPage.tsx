import { useMemo, useState } from 'react';
import { ErrorState, LoadingState } from '../../components/ui/AsyncState';
import { Button } from '../../components/ui/Button';
import { PageHeading } from '../../components/layout/PageHeading';
import { SearchField } from '../../components/ui/TextField';
import { SelectField } from '../../components/ui/SelectField';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ToolPhoto } from '../../components/ui/ToolPhoto';
import type { WarehouseInventoryItemView } from '../../domain/read-models/warehouse-operations';
import { ToolDecommissionDialog, ToolEditDialog } from './ToolDecisionDialogs';
import { useWarehouseInventory } from './use-warehouse-inventory';
import { useWarehouseScopes } from './use-warehouse-scopes';
import './admin-operations.css';
import { flaggedInventoryItems } from './inventory-selectors';
import { useInventoryDecisionController } from './use-inventory-decision-controller';
import { warehouseToolDecisionPolicy } from '../../domain/warehouse-tool-policy';
import { toHolderRef } from './holder-ref';

export function FlaggedToolsPage() {
  const [warehouseId, setWarehouseId] = useState('all');
  const [search, setSearch] = useState('');
  const scopes = useWarehouseScopes();
  const inventory = useWarehouseInventory(warehouseId, true);
  const query = search.trim().toLocaleLowerCase();
  const rows = useMemo(() => flaggedInventoryItems(inventory.data ?? [], query), [inventory.data, query]);
  const decisions = useInventoryDecisionController({
    items: inventory.data,
    inventoryBlocked: inventory.isFetching || inventory.isPaused || inventory.isError,
    scopesBlocked: scopes.isFetching || scopes.isPaused || scopes.isError,
  });
  if (inventory.isPending && !inventory.data) return <LoadingState label="Loading flagged tools…" />;
  if (!inventory.data)
    return <ErrorState message="Flagged tools could not be loaded." onRetry={() => void inventory.refetch()} />;
  if (scopes.isPending && !scopes.data) return <LoadingState label="Loading warehouse scopes…" />;
  if (scopes.isError)
    return (
      <ErrorState
        message="Warehouse scopes could not be loaded. Flagged actions are paused."
        onRetry={() => void scopes.refetch()}
      />
    );
  return (
    <div className="page-content admin-operations-page">
      <PageHeading
        eyebrow="Admin view · Warehouse operations"
        title="Flagged tools"
        description="Resolve damaged and lost units with evidence while keeping lifecycle history intact."
      />
      <span className="sr-only" data-testid="warehouse-decision-pending" aria-live="polite">
        {decisions.decisionPending ? 'Saving warehouse decision' : ''}
      </span>
      <div className="operations-toolbar operations-toolbar--inventory">
        <div className="operations-filters operations-filters--compact">
          <SearchField
            compact
            label="Search flagged tools"
            placeholder="Search tools…"
            value={search}
            onChange={setSearch}
          />
          <SelectField
            compact
            hideLabel
            searchable={false}
            label="Warehouse"
            value={warehouseId}
            onChange={setWarehouseId}
            options={[
              { value: 'all', label: 'All warehouses' },
              ...(scopes.data ?? []).map((warehouse) => ({ value: warehouse.id, label: warehouse.name })),
            ]}
          />
        </div>
      </div>
      {inventory.isError && (
        <ErrorState message="Flagged tools could not be refreshed." onRetry={() => void inventory.refetch()} />
      )}
      <SurfaceCard className="inventory-card">
        {rows.length ? (
          <div className="flagged-list">
            {rows.map((item) => (
              <FlaggedRow
                key={item.toolUnitId}
                item={item}
                busy={decisions.busy}
                onEdit={() => decisions.openEdit(item)}
                onRestore={() => decisions.restore(item)}
                onReturn={() => decisions.returnTool(item)}
                onDecommission={() => decisions.openDecommission(item)}
              />
            ))}
          </div>
        ) : (
          <p className="admin-empty">No active flagged tools match this view.</p>
        )}
      </SurfaceCard>
      {decisions.editItem && (
        <ToolEditDialog
          item={decisions.editItem}
          busy={decisions.busy}
          error={decisions.editError}
          onClose={decisions.closeEdit}
          onSave={decisions.saveEdit}
        />
      )}
      {decisions.decommissionItem && (
        <ToolDecommissionDialog
          item={decisions.decommissionItem}
          busy={decisions.busy}
          error={decisions.decommissionError}
          onClose={decisions.closeDecommission}
          onConfirm={decisions.decommission}
        />
      )}
      {decisions.restoreError && <ErrorState message={decisions.restoreError} onRetry={decisions.resetRestoreError} />}
      {decisions.returnError && <ErrorState message={decisions.returnError} onRetry={decisions.resetReturnError} />}
    </div>
  );
}

function FlaggedRow({
  item,
  busy,
  onEdit,
  onRestore,
  onReturn,
  onDecommission,
}: {
  item: WarehouseInventoryItemView;
  busy: boolean;
  onEdit(): void;
  onRestore(): void;
  onReturn(): void;
  onDecommission(): void;
}) {
  const policy = warehouseToolDecisionPolicy({ ...item, holder: toHolderRef(item.holder) });
  return (
    <article className="flagged-row">
      <div className="flagged-row__main">
        <ToolPhoto src={item.imageSrc} alt="" size="small" />
        <div className="flagged-row__body">
          <div className="flagged-row__heading">
            <h2>{item.toolName}</h2>
            <StatusBadge status={item.status} />
          </div>
          <span className="flagged-row__identity">
            {item.toolUnitId} · {item.warehouseName}
          </span>
          <p>
            {item.holder.name} · {item.category}
          </p>
        </div>
      </div>
      <div className="flagged-row__actions">
        <Button variant="secondary" disabled={busy || !policy.canEdit} onClick={onEdit}>
          Edit
        </Button>
        {policy.canRestore || policy.canDecommission ? (
          <>
            <Button aria-label="Restore to stock" disabled={busy || !policy.canRestore} onClick={onRestore}>
              Restore
            </Button>
            <Button variant="danger" disabled={busy || !policy.canDecommission} onClick={onDecommission}>
              Decommission
            </Button>
          </>
        ) : (
          <Button disabled={busy || !policy.canForceReturn} onClick={onReturn}>
            Force return
          </Button>
        )}
      </div>
    </article>
  );
}
