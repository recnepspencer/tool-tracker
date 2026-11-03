import { useRef, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage, isStaleRecord, result, type Model } from './client';
import { collect, useReferences } from './data';
import { useAssetCollection } from './field-state';
import { formatStamp } from './format';
import { useListLocation } from './list-location';
import { useCompany } from './session';
import { photoSrc } from './tool-status';

type Request = Model<'RequestView'>;
type Handoff = Model<'HandoffView'>;
type Asset = Model<'AssetView'>;

export type QueueKind = 'request' | 'return' | 'transfer';
export type QueueFilter = '' | 'request' | 'return';

/** One row of the warehouse queue, shaped like the demo's WarehouseQueueItemView. */
export interface QueueItem {
  key: string;
  kind: QueueKind;
  eyebrow: string;
  toolName: string;
  toolTag: string;
  imageSrc: string | null;
  personName: string;
  personRole: string;
  from: string;
  to: string;
  note: string;
  decisionNote: string;
  time: string;
  fulfilsRequest?: boolean;
  /** Present for open items the viewer may decide inline. */
  decline?: 'reject' | 'decline';
  approve?: 'approve' | 'accept';
  request?: Request;
  handoff?: Handoff;
  asset?: Asset;
}

const requestStatusLabels: Record<Request['status'], string> = {
  pending: 'Request to release',
  approved: 'Released · awaiting pickup',
  rejected: 'Request declined',
  withdrawn: 'Request withdrawn',
  fulfilled: 'Request fulfilled',
};
const handoffStatusLabels: Record<Handoff['status'], string> = {
  pending: 'Return to accept',
  accepted: 'Return accepted',
  declined: 'Return declined',
  cancelled: 'Return cancelled',
};
const transferStatusLabels: Record<Handoff['status'], string> = {
  pending: 'Transfer pending',
  accepted: 'Transfer accepted',
  declined: 'Transfer declined',
  cancelled: 'Transfer cancelled',
};
const roleLabels: Record<string, string> = {
  company_admin: 'Company admin',
  equipment_manager: 'Equipment manager',
  dispatcher: 'Dispatcher',
  estimator: 'Estimator',
  field_member: 'Field crew',
};

/**
 * Tool names and photos come from the shared inventory collection; only tools
 * missing from it are read singly, so a queue never fans out one read per row.
 */
export function useAssetLookup(ids: string[]) {
  const c = useCompany();
  const collection = useAssetCollection();
  const known = new Map((collection.tools.data ?? []).map((tool) => [tool.id, tool]));
  const missing = collection.tools.data ? [...new Set(ids)].filter((id) => !known.has(id)) : [];
  const extra = useQueries({
    queries: missing.map((asset_id) => ({
      queryKey: [c.company_id, 'tool', asset_id],
      queryFn: () =>
        api
          .GET('/api/companies/{company_id}/tools/{asset_id}', { params: { path: { ...c.path, asset_id } } })
          .then(result),
    })),
  });
  return (id: string): Asset | undefined => known.get(id) ?? extra.find((query) => query.data?.id === id)?.data;
}

export function useOperationsPageState() {
  const c = useCompany();
  const location = useListLocation();
  const review = location.params.get('review') ?? '';
  const rawKind = location.params.get('kind') ?? '';
  const kind: QueueFilter = rawKind === 'request' || rawKind === 'return' ? rawKind : '';
  const search = location.params.get('search') ?? '';
  const warehouse = location.params.get('warehouse') ?? '';
  const history = location.params.get('history') === 'true';
  const refs = useReferences();
  const requests = useQuery({
    queryKey: [c.company_id, 'requests', history, warehouse],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/tool-requests', {
            params: {
              path: c.path,
              query: { offset, pending: !history, ...(warehouse ? { warehouse_id: warehouse } : {}) },
            },
          })
          .then(result),
      ),
  });
  const handoffs = useQuery({
    queryKey: [c.company_id, 'handoffs', history, warehouse],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/handoffs', {
            params: {
              path: c.path,
              query: { offset, pending: !history, ...(warehouse ? { warehouse_id: warehouse } : {}) },
            },
          })
          .then(result),
      ),
  });
  const asset = useAssetLookup([...(requests.data ?? []), ...(handoffs.data ?? [])].map((item) => item.asset_id));
  const permissions = useQueuePermissions();
  const role = (membershipId: string) => {
    const person = refs.people.data?.find((item) => item.id === membershipId);
    return person?.title || (person ? (roleLabels[person.roles[0] ?? ''] ?? '') : '');
  };
  const base = (asset: Asset | undefined) => ({
    toolName: asset?.name ?? 'Tool',
    toolTag: asset?.asset_tag ?? '',
    imageSrc: photoSrc(c.company_id, asset?.registration_photo_id),
    asset,
  });

  const requestItems: QueueItem[] = (requests.data ?? []).map((request) => {
    const tool = asset(request.asset_id);
    const allowed = permissions.request(request);
    const open = request.status === 'pending' || request.status === 'approved';
    return {
      ...base(tool),
      key: `request:${request.id}`,
      kind: 'request',
      eyebrow: requestStatusLabels[request.status],
      personName: request.requester_name,
      personRole: role(request.requester_id),
      from: request.source_warehouse_id
        ? refs.warehouse(request.source_warehouse_id)
        : (tool?.holder_name ?? tool?.warehouse_name ?? 'Current holder'),
      to: request.requester_name,
      note: request.note,
      decisionNote: request.decision_note,
      time: formatStamp(request.decided_at && !open ? request.decided_at : request.requested_at),
      decline: allowed.reject ? 'reject' : undefined,
      approve: allowed.approve ? 'approve' : undefined,
      request,
    };
  });
  const handoffItems: QueueItem[] = (handoffs.data ?? []).map((handoff) => {
    const tool = asset(handoff.asset_id);
    // A return lands in a warehouse this person answers for. Everything else
    // (person-to-person transfers) belongs to history, not the gate queue.
    const isReturn = permissions.authority(handoff.destination_warehouse_id);
    const receiving = isReturn && permissions.handoff(handoff, tool).receiving;
    return {
      ...base(tool),
      key: `handoff:${handoff.id}`,
      kind: isReturn ? 'return' : 'transfer',
      eyebrow: (isReturn ? handoffStatusLabels : transferStatusLabels)[handoff.status],
      fulfilsRequest: handoff.tool_request_id !== null,
      personName: handoff.proposed_by_name,
      personRole: role(handoff.proposed_by_id),
      from: handoff.source_warehouse_id
        ? refs.warehouse(handoff.source_warehouse_id)
        : (tool?.holder_name ?? handoff.proposed_by_name),
      to: handoff.destination_name,
      note: handoff.note,
      decisionNote: handoff.resolution_note,
      time: formatStamp(handoff.resolved_at ?? handoff.proposed_at),
      decline: receiving ? 'decline' : undefined,
      approve: receiving ? 'accept' : undefined,
      handoff,
    };
  });
  // Handoffs that fulfil an approved request are represented by that request.
  const scoped = [...requestItems, ...handoffItems].filter(
    (item) => !item.fulfilsRequest && (item.kind !== 'transfer' || history),
  );
  const query = search.trim().toLocaleLowerCase();
  const visible = scoped.filter(
    (item) =>
      (!kind || item.kind === kind) &&
      (!query ||
        `${item.toolName} ${item.toolTag} ${item.personName} ${item.from} ${item.to}`
          .toLocaleLowerCase()
          .includes(query)),
  );
  const loaded = requests.data !== undefined && handoffs.data !== undefined;

  // Deep links (`?review=request:<id>` / `?review=handoff:<id>`) open from the
  // loaded records whether or not the item is in the visible group.
  const [reviewKind, reviewId] = review.split(':');
  const reviewRequest = reviewKind === 'request' ? requests.data?.find((item) => item.id === reviewId) : undefined;
  const reviewHandoff = reviewKind === 'handoff' ? handoffs.data?.find((item) => item.id === reviewId) : undefined;

  return {
    c,
    refs,
    requests,
    handoffs,
    loaded,
    error: requests.error ?? handoffs.error,
    retry: () => {
      void requests.refetch();
      void handoffs.refetch();
    },
    counts: {
      '': scoped.length,
      request: scoped.filter((item) => item.kind === 'request').length,
      return: scoped.filter((item) => item.kind === 'return').length,
    } satisfies Record<QueueFilter, number>,
    groups: {
      request: visible.filter((item) => item.kind === 'request'),
      return: visible.filter((item) => item.kind === 'return'),
      transfer: visible.filter((item) => item.kind === 'transfer'),
    },
    empty: visible.length === 0,
    asset,
    permissions,
    review,
    reviewRequest,
    reviewHandoff,
    reviewItem: [...requestItems, ...handoffItems].find((item) => item.key === review),
    openReview: (id: string) => location.update('review', id),
    kind,
    search,
    warehouse,
    history,
    // Completed history is its own queue tab, so choosing it clears the kind and vice versa.
    showHistory: () => {
      location.update('kind', '');
      location.update('history', 'true');
    },
    setKind: (value: QueueFilter) => {
      location.update('history', '');
      location.update('kind', value);
    },
    setSearch: (value: string) => location.update('search', value),
    setWarehouse: (value: string) => location.update('warehouse', value),
  };
}

/** Who may do what with a pending request or handoff, from the live permission rules. */
export function useQueuePermissions() {
  const c = useCompany();
  const authority = (id: string | null | undefined) =>
    !!id && (c.can('tools.manage') || c.managed_warehouse_ids.includes(id));
  return {
    authority,
    request: (request: Request) => {
      const open = request.status === 'pending' || request.status === 'approved';
      const manages = authority(request.source_warehouse_id);
      return {
        approve: request.status === 'pending' && manages && request.requester_eligible,
        reject: open && manages,
        withdraw: open && request.requester_id === c.membership_id,
      };
    },
    handoff: (handoff: Handoff, asset: Asset | undefined) => {
      const open = handoff.status === 'pending';
      const receiving =
        handoff.destination_membership_id === c.membership_id || authority(handoff.destination_warehouse_id);
      return {
        receiving: open && receiving,
        cancelling: open && handoff.proposed_by_id === c.membership_id,
        voidAllowed: open && authority(handoff.source_warehouse_id ?? asset?.responsible_warehouse_id),
      };
    },
  };
}

type RequestAction = 'approve' | 'reject' | 'withdraw';
type HandoffAction = 'accept' | 'decline' | 'cancel' | 'void';

/**
 * Queue decisions for the inline buttons and the review dialogs. The note stays
 * after a failure so the person can retry; a stale record reloads the queue.
 */
export function useQueueDecision() {
  const c = useCompany();
  const cache = useQueryClient();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const running = useRef(false);
  const refreshAll = () =>
    cache.invalidateQueries({ predicate: (query) => !['session', 'invitation'].includes(String(query.queryKey[0])) });
  async function run(command: () => Promise<unknown>, onDone?: () => void) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError('');
    try {
      await command();
      onDone?.();
      setNote('');
      await refreshAll();
    } catch (failure) {
      setError(errorMessage(failure));
      if (isStaleRecord(failure)) await refreshAll();
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return {
    note,
    setNote,
    busy,
    error,
    setError,
    decideRequest: (request: Request, action: RequestAction, onDone?: () => void) =>
      run(
        () =>
          api.POST('/api/companies/{company_id}/tool-requests/{request_id}/{action}', {
            params: { path: { ...c.path, request_id: request.id, action } },
            body: { expected_revision: request.revision, note: note.trim() },
          }),
        onDone,
      ),
    decideHandoff: (handoff: Handoff, action: HandoffAction, onDone?: () => void) =>
      run(
        () =>
          api.POST('/api/companies/{company_id}/handoffs/{handoff_id}/{action}', {
            params: { path: { ...c.path, handoff_id: handoff.id, action } },
            body: { expected_revision: handoff.revision, note: note.trim() },
          }),
        onDone,
      ),
  };
}
