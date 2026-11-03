import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { type Model } from './client';
import { useAssetCollection } from './field-state';
import { formatStamp } from './format';
import { useListLocation } from './list-location';
import { useRegistrationPolicy } from './registration-policy';
import { photoSrc, statusLabel, toolStatus } from './tool-status';

type Asset = Model<'AssetView'>;

export interface InventoryGroup {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  imageSrc: string | null;
  items: Asset[];
  statusSummary: string;
  warehouseLabel: string;
  lastMoved: string;
}

const custodian = (asset: Asset) => asset.holder_name ?? asset.warehouse_name ?? 'No current custodian';
export const lastMoved = (asset: Asset) => (asset.custody_started_at ? formatStamp(asset.custody_started_at) : '—');
export const inventoryHolder = custodian;

/** Port of the demo's inventory-selectors: one group per catalog model, with a status and warehouse summary. */
function groupInventory(companyId: string, tools: Asset[]): InventoryGroup[] {
  const groups = new Map<string, Asset[]>();
  for (const tool of tools) groups.set(tool.tool_model_id, [...(groups.get(tool.tool_model_id) ?? []), tool]);
  return [...groups.entries()].map(([id, items]) => {
    const first = items[0];
    const counts = new Map<string, number>();
    for (const item of items) {
      const label = statusLabel[toolStatus(item)].toLocaleLowerCase();
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    const warehouses = [...new Set(items.map((item) => item.responsible_warehouse_name))];
    const latest = items
      .map((item) => item.custody_started_at)
      .filter((value): value is string => !!value)
      .sort()
      .at(-1);
    return {
      id,
      name: first.name,
      brand: first.manufacturer,
      model: first.model_number,
      category: first.category_name,
      imageSrc: photoSrc(companyId, items.find((item) => item.registration_photo_id)?.registration_photo_id),
      items,
      statusSummary: [...counts.entries()].map(([label, count]) => `${count} ${label}`).join(' · '),
      warehouseLabel: warehouses.length === 1 ? warehouses[0] : `${warehouses.length} warehouses`,
      lastMoved: latest ? formatStamp(latest) : '—',
    };
  });
}

export function useInventoryView() {
  const { c, refs, tools } = useAssetCollection();
  const { canRegister } = useRegistrationPolicy();
  const { params, update } = useListLocation({ background: true });
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.pathname + location.search;
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const search = params.get('search') ?? '';
  const warehouse = params.get('warehouse') ?? '';
  const query = search.trim().toLocaleLowerCase();
  const active = (tools.data ?? []).filter((tool) => tool.lifecycle === 'active');
  const rows = active.filter(
    (tool) =>
      (!warehouse || tool.responsible_warehouse_id === warehouse) &&
      (!query ||
        [
          tool.asset_tag,
          tool.serial_number ?? '',
          tool.name,
          tool.manufacturer,
          tool.model_number,
          tool.category_name,
          tool.responsible_warehouse_name,
          tool.holder_name ?? '',
          tool.warehouse_name ?? '',
        ]
          .join(' ')
          .toLocaleLowerCase()
          .includes(query)),
  );
  return {
    c,
    tools,
    canRegister,
    returnTo,
    rows,
    activeTotal: active.length,
    groups: groupInventory(c.company_id, rows),
    search,
    warehouse,
    warehouseLabel: warehouse ? refs.warehouse(warehouse) : 'All warehouses',
    warehouseOptions: [
      { value: 'all', label: 'All warehouses' },
      ...(refs.warehouses.data ?? []).map((item) => ({ value: item.id, label: item.name })),
    ],
    expanded,
    setSearch: (value: string) => update('search', value),
    setWarehouse: (value: string) => update('warehouse', value === 'all' ? '' : value),
    open: (id: string) => navigate(`/app/tools/${id}`, { state: { returnTo } }),
    toggle: (id: string) =>
      setExpanded((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
  };
}
