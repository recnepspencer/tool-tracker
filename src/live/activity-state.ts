import { useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api, result, type Model } from './client';
import { collect } from './data';
import { useListLocation } from './list-location';
import { useCompany } from './session';
import { activityKind, activityTitle, metaText } from './activity-presentation';
import { photoSrc } from './tool-status';

const PAGE = 30;
const kinds = ['custody', 'request', 'flag', 'admin'] as const;
export type AuditKindFilter = 'all' | (typeof kinds)[number];
/** The demo's worker activity chips. */
export type ActivityFilter = 'all' | 'mine' | 'warehouse' | 'damage';

/** Same rule the shell uses to pick the control room over the worker shell. */
const usesControlShell = (c: ReturnType<typeof useCompany>) =>
  c.can('tools.manage') || c.can('people.manage') || c.can('jobs.manage') || c.managed_warehouse_ids.length > 0;

export type ActivityRow = {
  id: string;
  occurredAt: string;
  actor: string;
  action: string;
  kind: ReturnType<typeof activityKind>;
  assetId?: string;
  toolName?: string;
  unit?: string;
  warehouseId?: string;
  warehouseName?: string;
  imageSrc: string | null;
  note?: string;
  /** Worker sheet route for the tool, when the tool can be opened. */
  route?: string;
};

export function useActivityState() {
  const c = useCompany();
  const control = usesControlShell(c);
  const navigate = useNavigate();
  const location = useLocation();
  const { params, update } = useListLocation();
  const [, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const rawKind = params.get('kind') ?? '';
  const kind: AuditKindFilter = (kinds as readonly string[]).includes(rawKind) ? (rawKind as AuditKindFilter) : 'all';
  const warehouse = params.get('warehouse') ?? '';
  const mine = params.get('mine') === 'true';

  const warehouses = useQuery({
    queryKey: [c.company_id, 'warehouses'],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/warehouses', { params: { path: c.path, query: { offset, limit: 100 } } })
          .then(result),
      ),
  });

  const activity = useInfiniteQuery({
    queryKey: [c.company_id, 'activity-feed', search, kind, warehouse, mine],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api
        .GET('/api/companies/{company_id}/activity', {
          params: {
            path: c.path,
            query: {
              offset: pageParam,
              limit: PAGE,
              search,
              kind,
              ...(warehouse ? { warehouse_id: warehouse } : {}),
              mine,
            },
          },
        })
        .then(result),
    getNextPageParam: (last) => last.next_offset ?? undefined,
  });
  const events = activity.data?.pages.flatMap((page) => page.items) ?? [];

  // Activity carries only the asset id and tag; the tool's name, photo and holder
  // come from the same per-tool reads the tool sheet uses.
  const assetIds = c.can('tools.read')
    ? [...new Set(events.map((event) => metaText(event.metadata, 'asset_id')).filter((id) => id !== undefined))]
    : [];
  const assets = useQueries({
    queries: assetIds.map((asset_id) => ({
      queryKey: [c.company_id, 'tool', asset_id],
      queryFn: () =>
        api
          .GET('/api/companies/{company_id}/tools/{asset_id}', { params: { path: { ...c.path, asset_id } } })
          .then(result),
      retry: false,
    })),
  });
  const assetById = new Map<string, Model<'AssetView'>>();
  for (const query of assets) if (query.data) assetById.set(query.data.id, query.data);
  const warehouseName = (id: string | undefined) => warehouses.data?.find((item) => item.id === id)?.name;

  const rows: ActivityRow[] = events.map((event) => {
    const assetId = metaText(event.metadata, 'asset_id');
    const asset = assetId ? assetById.get(assetId) : undefined;
    const warehouseId = metaText(event.metadata, 'warehouse_id');
    return {
      id: event.id,
      occurredAt: event.occurred_at,
      actor: event.effective_name ?? 'System',
      action: activityTitle(event.event_key),
      kind: activityKind(event.event_key),
      assetId: c.can('tools.read') ? assetId : undefined,
      toolName: asset?.name,
      unit: asset?.serial_number ?? undefined,
      warehouseId,
      warehouseName: warehouseName(warehouseId) ?? asset?.responsible_warehouse_name,
      imageSrc: photoSrc(c.company_id, asset?.registration_photo_id),
      note: metaText(event.metadata, 'reason') ?? metaText(event.metadata, 'note'),
      route:
        assetId && c.can('tools.read')
          ? control
            ? `/app/tools/${assetId}`
            : `/app/${asset?.holder_membership_id === c.membership_id ? 'mine' : 'checkout'}/${assetId}`
          : undefined,
    };
  });

  const homeWarehouse = c.managed_warehouse_ids[0] ?? warehouses.data?.[0]?.id ?? '';
  const filter: ActivityFilter | null =
    kind === 'flag' && !mine && !warehouse
      ? 'damage'
      : warehouse && !mine && kind === 'all'
        ? 'warehouse'
        : mine && !warehouse && kind === 'all'
          ? 'mine'
          : kind === 'all' && !mine && !warehouse
            ? 'all'
            : null;
  // The chips are exclusive views, so one URL write replaces all three filters.
  const setFilter = (value: ActivityFilter) => {
    const next = new URLSearchParams(window.location.search);
    const set = (key: string, on: string) => (on ? next.set(key, on) : next.delete(key));
    set('mine', value === 'mine' ? 'true' : '');
    set('kind', value === 'damage' ? 'flag' : '');
    set('warehouse', value === 'warehouse' ? warehouse || homeWarehouse : '');
    next.delete('offset');
    setParams(next, { replace: true, state: location.state });
  };

  return {
    c,
    control,
    search,
    kind,
    warehouse,
    mine,
    filter,
    warehouses,
    activity,
    rows,
    setSearch: (value: string) => update('search', value),
    setKind: (value: AuditKindFilter) => update('kind', value === 'all' ? '' : value),
    setWarehouse: (value: string) => update('warehouse', value === 'all' ? '' : value),
    setMine: (value: boolean) => update('mine', value ? 'true' : ''),
    setFilter,
    loadMore: () => void activity.fetchNextPage(),
    open: (row: ActivityRow) =>
      row.route && navigate(row.route, { state: { returnTo: location.pathname + location.search } }),
  };
}
export type ActivityState = ReturnType<typeof useActivityState>;
