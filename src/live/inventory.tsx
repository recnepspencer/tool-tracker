import { Fragment, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { Model } from './client';
import { FlaggedToolsPage } from './flagged-tools';
import { inventoryHolder, lastMoved, useInventoryView, type InventoryGroup } from './inventory-state';
import {
  ChevronDownIcon,
  ErrorState,
  LoadingState,
  PageHeading,
  SearchField,
  SelectField,
  StatusBadge,
  SurfaceCard,
  ToolPhoto,
} from './kit';
import { assetLabel, photoSrc, toolStatus } from './tool-status';

type Asset = Model<'AssetView'>;

const activate = (action: () => void) => (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    action();
  }
};

/** The control-room tool list: inventory, or the damaged & lost view on `/app/flagged`. */
export function InventoryPage({ flagged = false }: { flagged?: boolean }) {
  return flagged ? <FlaggedToolsPage /> : <WarehouseInventoryPage />;
}

/** Demo WarehouseInventoryPage over the live tool collection. */
function WarehouseInventoryPage() {
  const view = useInventoryView();
  if (view.tools.isPending) return <LoadingState label="Loading warehouse inventory…" />;
  if (!view.tools.data)
    return (
      <ErrorState message="The warehouse inventory could not be loaded." onRetry={() => void view.tools.refetch()} />
    );
  return (
    <div className="page-content admin-operations-page">
      <PageHeading
        title="Inventory"
        description={`${view.rows.length} of ${view.activeTotal} ${view.activeTotal === 1 ? 'tool' : 'tools'} · ${view.warehouseLabel}`}
        action={
          view.canRegister ? (
            <Link className="button button--primary" to="/app/tools/new" state={{ returnTo: view.returnTo }}>
              <Plus aria-hidden="true" />
              Add tool
            </Link>
          ) : undefined
        }
      />
      <div className="operations-toolbar operations-toolbar--inventory">
        <div className="operations-filters operations-filters--compact">
          <SearchField
            compact
            label="Search inventory"
            placeholder="Search tools…"
            value={view.search}
            onChange={view.setSearch}
          />
          <SelectField
            compact
            hideLabel
            searchable={false}
            label="Warehouse"
            value={view.warehouse || 'all'}
            onChange={view.setWarehouse}
            options={view.warehouseOptions}
          />
        </div>
      </div>
      {view.tools.isError && (
        <ErrorState message="The inventory could not be refreshed." onRetry={() => void view.tools.refetch()} />
      )}
      <SurfaceCard className="inventory-card">
        {view.rows.length ? (
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
                {view.groups.map((group) => {
                  if (group.items.length === 1) {
                    const item = group.items[0];
                    return (
                      <InventoryRow
                        key={item.id}
                        item={item}
                        companyId={view.c.company_id}
                        onOpen={() => view.open(item.id)}
                      />
                    );
                  }
                  const expanded = view.expanded.has(group.id);
                  return (
                    <Fragment key={group.id}>
                      <InventoryGroupRow group={group} expanded={expanded} onToggle={() => view.toggle(group.id)} />
                      {expanded
                        ? group.items.map((item) => (
                            <InventoryRow
                              key={item.id}
                              item={item}
                              nested
                              companyId={view.c.company_id}
                              onOpen={() => view.open(item.id)}
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
    </div>
  );
}

function InventoryGroupRow({
  group,
  expanded,
  onToggle,
}: {
  group: InventoryGroup;
  expanded: boolean;
  onToggle(): void;
}) {
  return (
    <tr
      className="inventory-group-row"
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      aria-label={`${expanded ? 'Collapse' : 'Expand'} ${group.name}, ${group.items.length} tools`}
      onClick={onToggle}
      onKeyDown={activate(onToggle)}
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
            <span className="inventory-tool__mobile-context">{group.statusSummary}</span>
          </div>
        </div>
      </td>
      <td>{group.items.length} individual tools</td>
      <td className="inventory-group-status">{group.statusSummary}</td>
      <td>{group.warehouseLabel}</td>
      <td>{group.lastMoved}</td>
    </tr>
  );
}

function InventoryRow({
  item,
  companyId,
  nested = false,
  onOpen,
}: {
  item: Asset;
  companyId: string;
  nested?: boolean;
  onOpen(): void;
}) {
  const holder = inventoryHolder(item);
  const moved = lastMoved(item);
  return (
    <tr
      className={`inventory-row${nested ? ' inventory-row--nested' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`Open ${item.name}, ${item.asset_tag}`}
      onClick={onOpen}
      onKeyDown={activate(onOpen)}
    >
      <td>
        <div className="inventory-tool">
          <ToolPhoto src={photoSrc(companyId, item.registration_photo_id)} alt="" size="small" />
          <div>
            <strong>{nested ? item.serial_number || item.asset_tag : item.name}</strong>
            <span>{nested ? `${item.asset_tag} · ${item.name}` : `${item.asset_tag} · ${item.category_name}`}</span>
            <span className="inventory-tool__mobile-context">
              {item.responsible_warehouse_name} · {holder} · {moved}
            </span>
          </div>
        </div>
      </td>
      <td>{holder}</td>
      <td>
        <StatusBadge tone={toolStatus(item)}>{assetLabel(item)}</StatusBadge>
        {item.pending_handoff_id && <span className="inventory-pending-label">In transfer</span>}
      </td>
      <td>{item.responsible_warehouse_name}</td>
      <td>{moved}</td>
    </tr>
  );
}
