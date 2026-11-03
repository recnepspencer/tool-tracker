import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, requestKey, result, type Model } from './client';
import { collect, useReferences } from './data';
import { useCompany } from './session';
import { useListLocation } from './list-location';
import { useSheetNavigation } from './sheet-navigation';

export type TransferMode = 'warehouse' | 'person';
export type RequestUnit = { unitId: string; warehouseId: string; warehouseName: string };

/** The demo's two-step destination picker: a destination type, then a person or warehouse. */
export function useTransferPicker() {
  const [mode, setModeValue] = useState<TransferMode | null>(null);
  const [target, setTarget] = useState('');
  return {
    mode,
    target,
    setTarget,
    setMode: (value: TransferMode | null) => {
      setModeValue(value);
      setTarget('');
    },
    reset: () => {
      setModeValue(null);
      setTarget('');
    },
  };
}

/** A single local choice for a dialog field whose value also drives its heading. */
export function useChoice<T extends string>(initial: T) {
  const [value, setValue] = useState<T>(initial);
  return [value, setValue] as const;
}

const workerActions = ['request', 'transfer', 'damage', 'missing'];
const controlActions = [
  'edit',
  'transfer',
  'damage',
  'missing',
  'restore',
  'service',
  'lifecycle',
  'stewardship',
  'reconcile',
];

export function useToolDetailState() {
  const c = useCompany();
  const refs = useReferences();
  const navigate = useNavigate();
  const location = useLocation();
  const sheet = useSheetNavigation();
  const control = sheet.root === '/app/tools' || sheet.root === '/app/flagged';
  const { assetId = '' } = useParams();
  const path = { ...c.path, asset_id: assetId };
  const [key, setKey] = useState(requestKey);
  const picker = useTransferPicker();
  const list = useListLocation();
  const rawAction = list.params.get('action') ?? '';
  const action =
    (control ? controlActions : workerActions).includes(rawAction) || rawAction.startsWith('found:') ? rawAction : '';
  const tool = useQuery({
    queryKey: [c.company_id, 'tool', assetId],
    queryFn: () => api.GET('/api/companies/{company_id}/tools/{asset_id}', { params: { path } }).then(result),
  });
  const history = useQuery({
    queryKey: [c.company_id, 'custody', assetId],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/tools/{asset_id}/custody', {
            params: { path, query: { offset, limit: 100 } },
          })
          .then(result),
      ),
  });
  const requests = useQuery({
    queryKey: [c.company_id, 'own-tool-requests', assetId, c.membership_id],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/tool-requests', {
            params: { path: c.path, query: { offset, asset_id: assetId, mine: true } },
          })
          .then(result),
      ),
  });
  // The control room shows anyone's open checkout request for this unit.
  const assetRequests = useQuery({
    queryKey: [c.company_id, 'asset-tool-requests', assetId],
    enabled: control,
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/tool-requests', {
            params: { path: c.path, query: { offset, asset_id: assetId, pending: true } },
          })
          .then(result),
      ),
  });
  const pendingHandoffId = tool.data?.pending_handoff_id ?? null;
  const handoffs = useQuery({
    queryKey: [c.company_id, 'pending-handoffs', control ? 'all' : 'mine'],
    enabled: !!pendingHandoffId,
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/handoffs', {
            params: { path: c.path, query: { offset, pending: true, ...(control ? {} : { mine: true }) } },
          })
          .then(result),
      ),
  });
  const incidents = useQuery({
    queryKey: [c.company_id, 'incidents', assetId, 'all'],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/incidents', {
            params: { path: c.path, query: { asset_id: assetId, offset, open_only: false } },
          })
          .then(result),
      ),
  });
  const service = useQuery({
    queryKey: [c.company_id, 'service', assetId],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/tools/{asset_id}/service', { params: { path, query: { offset } } })
          .then(result),
      ),
  });
  const lifecycle = useQuery({
    queryKey: [c.company_id, 'lifecycle', assetId],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/tools/{asset_id}/lifecycle', {
            params: { path, query: { offset } },
          })
          .then(result),
      ),
  });
  // Checkout cards pass the requestable units of the model, as the demo's request sheet receives them.
  const requestUnits: RequestUnit[] =
    sheet.root === '/app/checkout' && Array.isArray(location.state?.requestUnits)
      ? (location.state.requestUnits as RequestUnit[]).filter(
          (unit) => typeof unit?.unitId === 'string' && typeof unit?.warehouseName === 'string',
        )
      : [];

  const setAction = (value: string) => {
    if (!value) picker.reset();
    list.update('action', value);
  };

  return {
    c,
    refs,
    path,
    key,
    control,
    close: sheet.close,
    renewKey: () => setKey(requestKey()),
    tool,
    history,
    incidents,
    service,
    lifecycle,
    requests,
    assetRequests,
    pendingHandoff: handoffs.data?.find((handoff) => handoff.id === pendingHandoffId) ?? null,
    requestUnits,
    chooseRequestUnit: (unitId: string) =>
      navigate(
        { pathname: `${sheet.root}/${unitId}`, search: '?action=request' },
        { replace: true, state: location.state },
      ),
    picker,
    action,
    setAction,
    retryHistory: () => {
      void history.refetch();
      void incidents.refetch();
      void service.refetch();
      void lifecycle.refetch();
    },
  };
}

export type ToolDetailState = ReturnType<typeof useToolDetailState>;

/** What the signed-in member may do with this unit; mirrors the server's custody rules. */
export function toolPermissions(state: ToolDetailState, t: Model<'AssetView'>) {
  const { c, incidents, requests } = state;
  const manages = c.can('tools.manage') || c.managed_warehouse_ids.includes(t.responsible_warehouse_id);
  const canHandoff =
    t.warehouse_id !== null && (c.can('tools.manage') || c.managed_warehouse_ids.includes(t.warehouse_id));
  const holds = t.holder_membership_id === c.membership_id;
  const open = incidents.data?.filter((incident) => !incident.resolved_at) ?? [];
  return {
    manages,
    holds,
    request: c.can('tools.request') && (t.requestable || !!requests.data?.length),
    transfer: (holds || canHandoff) && t.lifecycle === 'active' && !t.missing,
    report: (holds || manages) && t.lifecycle === 'active',
    damageOpen: open.some((incident) => incident.kind === 'damage'),
    missingOpen: open.some((incident) => incident.kind === 'missing'),
    service: manages && t.lifecycle !== 'disposed',
    restore: manages && t.lifecycle !== 'disposed' && t.serviceability !== 'serviceable',
    lifecycle: manages && t.lifecycle !== 'disposed',
    edit: c.can('tools.manage'),
    stewardship: c.can('tools.manage'),
    reconcile: c.can('reconciliation.manage'),
  };
}

export type ToolPermissions = ReturnType<typeof toolPermissions>;

/** People and warehouses that may receive this unit, as the demo's destination candidates. */
export function transferCandidates(state: ToolDetailState, t: Model<'AssetView'>) {
  const people = (state.refs.people.data ?? []).filter(
    (person) =>
      t.serviceability === 'serviceable' &&
      person.id !== t.holder_membership_id &&
      person.access_state === 'active' &&
      !person.ended_at &&
      person.capabilities.includes('tools.transfer'),
  );
  const warehouses = (state.refs.warehouses.data ?? []).filter(
    (warehouse) => warehouse.id !== t.warehouse_id && !warehouse.archived_at,
  );
  return { people, warehouses };
}
