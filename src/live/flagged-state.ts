import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { api, result, type Model } from './client';
import { collect } from './data';
import { useAssetCollection } from './field-state';
import { useListLocation } from './list-location';

export type FlaggedCondition = 'all' | 'damaged' | 'lost';
type Asset = Model<'AssetView'>;
type Incident = Model<'IncidentView'>;

export interface FlaggedRowModel {
  asset: Asset;
  incidents: Incident[];
  policy: { canEdit: boolean; canRestore: boolean; canDecommission: boolean; canForceReturn: boolean };
}

/** Damaged & lost: open incidents joined to the active tools they flag, one row per tool. */
export function useFlaggedTools() {
  const { c, refs, tools } = useAssetCollection();
  const location = useLocation();
  const { params, update } = useListLocation({ background: true });
  const search = params.get('search') ?? '';
  const warehouse = params.get('warehouse') ?? '';
  const rawCondition = params.get('condition') ?? 'all';
  const condition: FlaggedCondition = rawCondition === 'damaged' || rawCondition === 'lost' ? rawCondition : 'all';
  const incidents = useQuery({
    queryKey: [c.company_id, 'incidents', 'open'],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/incidents', {
            params: { path: c.path, query: { offset, limit: 100, open_only: true } },
          })
          .then(result),
      ),
  });
  const byAsset = new Map<string, Incident[]>();
  for (const incident of incidents.data ?? [])
    byAsset.set(incident.asset_id, [...(byAsset.get(incident.asset_id) ?? []), incident]);
  const manages = (asset: Asset) =>
    c.can('tools.manage') || c.managed_warehouse_ids.includes(asset.responsible_warehouse_id);
  const query = search.trim().toLocaleLowerCase();
  const rows: FlaggedRowModel[] = (tools.data ?? [])
    .filter((asset) => asset.lifecycle === 'active')
    .map((asset) => ({ asset, incidents: byAsset.get(asset.id) ?? [] }))
    .filter(({ asset, incidents }) => incidents.length || asset.missing || asset.serviceability !== 'serviceable')
    .filter(
      ({ asset, incidents }) =>
        (condition === 'all' ||
          (condition === 'damaged'
            ? incidents.some((item) => item.kind === 'damage') || asset.serviceability !== 'serviceable'
            : incidents.some((item) => item.kind === 'missing') || asset.missing)) &&
        (!warehouse || asset.responsible_warehouse_id === warehouse) &&
        (!query ||
          [
            asset.name,
            asset.asset_tag,
            asset.category_name,
            asset.responsible_warehouse_name,
            asset.holder_name ?? '',
            asset.warehouse_name ?? '',
            ...incidents.map((item) => item.description),
          ]
            .join(' ')
            .toLocaleLowerCase()
            .includes(query)),
    )
    .map(({ asset, incidents }) => {
      const allowed = manages(asset);
      const flaggedNow = asset.missing || asset.serviceability !== 'serviceable';
      const warehouseHeld = !asset.holder_membership_id;
      return {
        asset,
        incidents,
        policy: {
          canEdit: allowed,
          canRestore: allowed && flaggedNow && warehouseHeld,
          canDecommission: allowed && warehouseHeld,
          canForceReturn: allowed && !warehouseHeld && !asset.pending_handoff_id,
        },
      };
    });
  return {
    c,
    tools,
    incidents,
    rows,
    search,
    condition,
    warehouse,
    returnTo: location.pathname + location.search,
    warehouseOptions: [
      { value: 'all', label: 'All warehouses' },
      ...(refs.warehouses.data ?? []).map((item) => ({ value: item.id, label: item.name })),
    ],
    setSearch: (value: string) => update('search', value),
    setCondition: (value: FlaggedCondition) => update('condition', value === 'all' ? '' : value),
    setWarehouse: (value: string) => update('warehouse', value === 'all' ? '' : value),
  };
}
