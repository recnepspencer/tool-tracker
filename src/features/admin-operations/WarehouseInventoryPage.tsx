import { Fragment, useMemo, useState } from 'react';
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
import { ToolDecommissionDialog, ToolEditDialog, ToolFlagDialog } from './ToolDecisionDialogs';
import { Button } from '../../components/ui/Button';
import './admin-operations.css';
import { filterInventoryItems, groupInventoryItems, type InventoryToolGroup } from './inventory-selectors';
import { useInventoryDecisionController } from './use-inventory-decision-controller';
import { WarehouseStockDialog } from './WarehouseStockDialog';
import { InventoryToolDrawer } from './InventoryToolDrawer';
import { ChevronDownIcon } from '../../components/ui/ChevronDownIcon';

export function WarehouseInventoryPage() {
  const [warehouseId, setWarehouseId] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [stockOpen, setStockOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const warehouses = useWarehouseScopes();
  const inventory = useWarehouseInventory(warehouseId);
  const rows = useMemo(() => filterInventoryItems(inventory.data ?? [], 'all', search), [inventory.data, search]);
  const groups = useMemo(() => groupInventoryItems(rows), [rows]);
  const selectedItem = inventory.data?.find((item) => item.toolUnitId === selectedToolId) ?? null;
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
  const warehouseLabel =
    warehouseId === 'all'
      ? 'All warehouses'
      : (warehouses.data?.find((warehouse) => warehouse.id === warehouseId)?.name ?? 'Warehouse');
  return (
    <div className="page-content admin-operations-page">
      <PageHeading
        title="Inventory"
        description={`${rows.length} of ${inventory.data.length} tools · ${warehouseLabel}`}
        action={
          <Button className="operations-add-button" onClick={() => setStockOpen(true)}>
            <Plus aria-hidden="true" />
            Add tool
          </Button>
        }
      />
      <div className="operations-toolbar operations-toolbar--inventory">
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
                  <th>Holder</th>
                  <th>Status</th>
                  <th>Warehouse</th>
                  <th>Last moved</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => {
                  if (group.items.length === 1) {
                    const item = group.items[0];
                    return (
                      <InventoryRow
                        key={item.toolUnitId}
                        item={item}
                        onOpen={() => setSelectedToolId(item.toolUnitId)}
                      />
                    );
                  }
                  const expanded = expandedGroups.has(group.id);
                  return (
                    <Fragment key={group.id}>
                      <InventoryGroupRow
                        group={group}
                        expanded={expanded}
                        onToggle={() =>
                          setExpandedGroups((current) => {
                            const next = new Set(current);
                            if (next.has(group.id)) next.delete(group.id);
                            else next.add(group.id);
                            return next;
                          })
                        }
                      />
                      {expanded
                        ? group.items.map((item) => (
                            <InventoryRow
                              key={item.toolUnitId}
                              item={item}
                              nested
                              onOpen={() => setSelectedToolId(item.toolUnitId)}
                            />
                          ))
                        : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="admin-empty">No tools match this inventory view.</p>
        )}
      </SurfaceCard>
      {selectedItem && (
        <InventoryToolDrawer
          item={selectedItem}
          busy={decisions.busy}
          onClose={() => setSelectedToolId(null)}
          onEdit={() => decisions.openEdit(selectedItem)}
          onFlag={(condition) => decisions.openFlag(selectedItem, condition)}
          onRestore={() => decisions.restore(selectedItem)}
          onForceReturn={() => decisions.returnTool(selectedItem)}
          onDecommission={() => decisions.openDecommission(selectedItem)}
        />
      )}
      {decisions.editItem && (
        <ToolEditDialog
          item={decisions.editItem}
          busy={decisions.busy}
          error={decisions.editError}
          onClose={decisions.closeEdit}
          onSave={decisions.saveEdit}
        />
      )}
      {decisions.flagError && <ErrorState message={decisions.flagError} onRetry={decisions.resetFlagError} />}
      {decisions.flagItem && (
        <ToolFlagDialog
          item={decisions.flagItem}
          initialCondition={decisions.flagCondition}
          busy={decisions.busy}
          error={decisions.flagError}
          onClose={decisions.closeFlag}
          onSave={decisions.saveFlag}
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
      {stockOpen && (
        <WarehouseStockDialog
          defaultWarehouseId={warehouseId === 'all' ? undefined : warehouseId}
          onClose={() => setStockOpen(false)}
        />
      )}
    </div>
  );
}

function InventoryGroupRow({
  group,
  expanded,
  onToggle,
}: {
  group: InventoryToolGroup;
  expanded: boolean;
  onToggle(): void;
}) {
  const statusCounts = new Map<string, number>();
  group.items.forEach((item) => statusCounts.set(item.status, (statusCounts.get(item.status) ?? 0) + 1));
  const statusSummary = [...statusCounts.entries()]
    .map(([status, count]) => `${count} ${status.replace('-', ' ')}`)
    .join(' · ');
  const warehouseNames = [...new Set(group.items.map((item) => item.warehouseName))];
  const latest = [...group.items].sort((left, right) => right.lastMovedAt.localeCompare(left.lastMovedAt))[0];
  return (
    <tr
      className="inventory-group-row"
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      aria-label={`${expanded ? 'Collapse' : 'Expand'} ${group.name}, ${group.items.length} tools`}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onToggle();
        }
      }}
    >
      <td>
        <div className="inventory-tool inventory-tool--group">
          <ChevronDownIcon className="inventory-group-chevron" />
          <ToolPhoto src={group.imageSrc} alt="" size="small" />
          <div>
            <strong>{group.name}</strong>
            <span>
              {group.brand} · {group.model} · {group.category}
            </span>
            <span className="inventory-tool__mobile-context">{statusSummary}</span>
          </div>
        </div>
      </td>
      <td>{group.items.length} individual tools</td>
      <td className="inventory-group-status">{statusSummary}</td>
      <td>{warehouseNames.length === 1 ? warehouseNames[0] : `${warehouseNames.length} warehouses`}</td>
      <td>{latest?.lastMoved}</td>
    </tr>
  );
}

function InventoryRow({
  item,
  nested = false,
  onOpen,
}: {
  item: WarehouseInventoryItemView;
  nested?: boolean;
  onOpen(): void;
}) {
  return (
    <tr
      className={`inventory-row${nested ? ' inventory-row--nested' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`Open ${item.toolName}, ${item.toolUnitId}`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <td>
        <div className="inventory-tool">
          <ToolPhoto src={item.imageSrc} alt="" size="small" />
          <div>
            <strong>{nested ? item.serial || item.toolUnitId : item.toolName}</strong>
            <span>{nested ? `${item.toolUnitId} · ${item.toolName}` : `${item.toolUnitId} · ${item.category}`}</span>
            <span className="inventory-tool__mobile-context">
              {item.warehouseName} · {item.holder.name} · {item.lastMoved}
            </span>
          </div>
        </div>
      </td>
      <td>{item.holder.name}</td>
      <td>
        <StatusBadge status={item.status} />
      </td>
      <td>{item.warehouseName}</td>
      <td>{item.lastMoved}</td>
    </tr>
  );
}
