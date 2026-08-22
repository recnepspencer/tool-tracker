import { useMemo, useState } from 'react';
import { ErrorState, LoadingState } from '../../components/ui/AsyncState';
import { Button } from '../../components/ui/Button';
import { PageHeading } from '../../components/layout/PageHeading';
import { DirectoryToolbar } from '../../components/layout/DirectoryToolbar';
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
  const [condition, setCondition] = useState<'all' | 'damaged' | 'lost'>('all');
  const scopes = useWarehouseScopes();
  const inventory = useWarehouseInventory(warehouseId, true);
  const query = search.trim().toLocaleLowerCase();
  const rows = useMemo(
    () =>
      flaggedInventoryItems(inventory.data ?? [], query).filter(
        (item) => condition === 'all' || item.status === condition,
      ),
    [condition, inventory.data, query],
  );
  const decisions = useInventoryDecisionController({
    items: inventory.data,
    inventoryBlocked: inventory.isFetching || inventory.isPaused || inventory.isError,
    scopesBlocked: scopes.isFetching || scopes.isPaused || scopes.isError,
  });
  if (inventory.isPending && !inventory.data) return <LoadingState label="Loading damaged and lost tools…" />;
  if (!inventory.data)
    return (
      <ErrorState message="Damaged and lost tools could not be loaded." onRetry={() => void inventory.refetch()} />
    );
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
        title="Damaged & lost"
        description="Review flagged tools and decide what happens next."
      />
      <span className="sr-only" data-testid="warehouse-decision-pending" aria-live="polite">
        {decisions.decisionPending ? 'Saving warehouse decision' : ''}
      </span>
      <DirectoryToolbar<'all' | 'damaged' | 'lost'>
        searchLabel="Search damaged and lost tools"
        searchPlaceholder="Search tools…"
        search={search}
        onSearchChange={setSearch}
        filterLabel="Condition filter"
        filters={[
          { value: 'all', label: 'All' },
          { value: 'damaged', label: 'Damaged' },
          { value: 'lost', label: 'Lost' },
        ]}
        activeFilter={condition}
        onFilterChange={setCondition}
        trailing={
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
        }
      />
      {inventory.isError && (
        <ErrorState message="Damaged and lost tools could not be refreshed." onRetry={() => void inventory.refetch()} />
      )}
      <SurfaceCard className="inventory-card flagged-card">
        {rows.length ? (
          <div className="flagged-list">
            <div className="flagged-list__header" aria-hidden="true">
              <span>Tool</span>
              <span>Issue</span>
              <span>Current custody</span>
              <span>Actions</span>
            </div>
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
          <p className="admin-empty">No damaged or lost tools match this view.</p>
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
        <ToolPhoto src={item.imageSrc} alt="" size="small" priority />
        <div className="flagged-row__body">
          <h2>{item.toolName}</h2>
          <span className="flagged-row__identity">
            {item.toolUnitId} · {item.category}
          </span>
        </div>
      </div>
      <div className="flagged-row__issue">
        <StatusBadge status={item.status} />
      </div>
      <div className="flagged-row__custody">
        <strong>{item.holder.name}</strong>
        <span>{item.holder.type === 'warehouse' ? 'Warehouse custody' : `Home warehouse · ${item.warehouseName}`}</span>
      </div>
      <div className="flagged-row__actions">
        <Button variant="ghost" disabled={busy || !policy.canEdit} onClick={onEdit}>
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
