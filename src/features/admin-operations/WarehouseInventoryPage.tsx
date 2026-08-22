import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { ErrorState, LoadingState } from '../../components/ui/AsyncState';
import { PageHeading } from '../../components/layout/PageHeading';
import { SearchField } from '../../components/ui/TextField';
import { SelectField } from '../../components/ui/SelectField';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ToolPhoto } from '../../components/ui/ToolPhoto';
import { useWarehouseInventory } from './use-warehouse-inventory';
import { useWarehouseScopes } from './use-warehouse-scopes';
import type { WarehouseInventoryItemView } from '../../domain/read-models/warehouse-operations';
import { ToolFlagDialog } from './ToolDecisionDialogs';
import { Button } from '../../components/ui/Button';
import './admin-operations.css';
import { countInventoryFilter, filterInventoryItems, type InventoryFilter } from './inventory-selectors';
import { useInventoryDecisionController } from './use-inventory-decision-controller';
import { warehouseToolDecisionPolicy } from '../../domain/warehouse-tool-policy';
import { toHolderRef } from './holder-ref';
import { WarehouseStockDialog } from './WarehouseStockDialog';

export function WarehouseInventoryPage() {
  const [warehouseId, setWarehouseId] = useState('all');
  const [filter, setFilter] = useState<InventoryFilter>('all');
  const [search, setSearch] = useState('');
  const [stockOpen, setStockOpen] = useState(false);
  const warehouses = useWarehouseScopes();
  const inventory = useWarehouseInventory(warehouseId, true);
  const rows = useMemo(
    () => filterInventoryItems(inventory.data ?? [], filter, search),
    [filter, inventory.data, search],
  );
  const inventoryBlocked = inventory.isFetching || inventory.isPaused || inventory.isError;
  const scopesBlocked = warehouses.isFetching || warehouses.isPaused || warehouses.isError;
  const decisions = useInventoryDecisionController({
    items: inventory.data,
    inventoryBlocked,
    scopesBlocked,
  });
  if (inventory.isPending && !inventory.data) return <LoadingState label="Loading warehouse inventory…" />;
  if (!inventory.data)
    return (
      <ErrorState message="The warehouse inventory could not be loaded." onRetry={() => void inventory.refetch()} />
    );
  if (warehouses.isPending && !warehouses.data) return <LoadingState label="Loading warehouse scopes…" />;
  if (warehouses.isError)
    return (
      <ErrorState
        message="Warehouse scopes could not be loaded. Inventory filters are unavailable until it recovers."
        onRetry={() => void warehouses.refetch()}
      />
    );
  const labels: Array<[InventoryFilter, string]> = [
    ['all', 'All'],
    ['in-stock', 'In stock'],
    ['checked-out', 'Checked out'],
    ['flagged', 'Flagged'],
    ['archived', 'Archived'],
  ];
  const inventoryActionsBlocked = decisions.busy;
  return (
    <div className="page-content admin-operations-page">
      <PageHeading
        eyebrow="Admin view · Warehouse operations"
        title="Inventory"
        description="Search every tool unit, its custody, and its lifecycle."
        action={
          <Button className="operations-add-button" onClick={() => setStockOpen(true)}>
            <Plus aria-hidden="true" />
            Add tool
          </Button>
        }
      />
      <div className="operations-toolbar operations-toolbar--inventory">
        <div className="operations-tabs" role="tablist" aria-label="Inventory filter">
          {labels.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              className={filter === value ? 'operations-tab operations-tab--active' : 'operations-tab'}
              onClick={() => setFilter(value)}
            >
              {label}
              <span>{countInventoryFilter(inventory.data, value)}</span>
            </button>
          ))}
        </div>
        <div className="operations-filters operations-filters--compact">
          <SearchField
            compact
            label="Search inventory"
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
              ...(warehouses.data ?? []).map((warehouse) => ({ value: warehouse.id, label: warehouse.name })),
            ]}
          />
        </div>
      </div>
      {inventory.isError && (
        <ErrorState message="The inventory could not be refreshed." onRetry={() => void inventory.refetch()} />
      )}
      <SurfaceCard className="inventory-card">
        {rows.length ? (
          <div className="inventory-table-wrap">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Tool</th>
                  <th>Warehouse</th>
                  <th>Status</th>
                  <th>Holder</th>
                  <th>Last moved</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <InventoryRow
                    key={item.toolUnitId}
                    item={item}
                    onFlag={
                      warehouseToolDecisionPolicy({ ...item, holder: toHolderRef(item.holder) }).canFlag &&
                      !inventoryActionsBlocked
                        ? () => decisions.openFlag(item)
                        : undefined
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="admin-empty">No tools match this inventory view.</p>
        )}
      </SurfaceCard>
      {decisions.flagError && <ErrorState message={decisions.flagError} onRetry={decisions.resetFlagError} />}
      {decisions.flagItem && (
        <ToolFlagDialog
          item={decisions.flagItem}
          busy={decisions.busy}
          error={decisions.flagError}
          onClose={decisions.closeFlag}
          onSave={decisions.saveFlag}
        />
      )}
      {stockOpen && (
        <WarehouseStockDialog
          defaultWarehouseId={warehouseId === 'all' ? undefined : warehouseId}
          onClose={() => setStockOpen(false)}
        />
      )}
    </div>
  );
}

function InventoryRow({ item, onFlag }: { item: WarehouseInventoryItemView; onFlag?: () => void }) {
  return (
    <tr>
      <td>
        <div className="inventory-tool">
          <ToolPhoto src={item.imageSrc} alt="" size="small" />
          <div>
            <strong>{item.toolName}</strong>
            <span>
              {item.toolUnitId} · {item.category}
            </span>
            <span className="inventory-tool__mobile-context">
              {item.warehouseName} · {item.holder.name} · {item.lastMoved}
            </span>
          </div>
        </div>
      </td>
      <td>{item.warehouseName}</td>
      <td>
        <StatusBadge status={item.status} />
        {item.lifecycle === 'archived' && <span className="lifecycle-pill lifecycle-pill--removed">Archived</span>}
      </td>
      <td>{item.holder.name}</td>
      <td>{item.lastMoved}</td>
      <td>
        {onFlag ? (
          <Button variant="secondary" onClick={onFlag}>
            Flag
          </Button>
        ) : (
          <span className="muted-action">—</span>
        )}
      </td>
    </tr>
  );
}
