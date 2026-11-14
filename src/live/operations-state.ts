import { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage, isStaleRecord, result, type Model } from './client';
import { collect, useReferences } from './data';
import { useAssetCollection } from './field-state';
import { useFlaggedTools } from './flagged-state';
import { useListLocation } from './list-location';
import { groupQueue, queueHistory, queuePermissions, type QueueEntry, type QueueNames } from './queue-groups';
import { useCompany } from './session';

export type { QueueEntry } from './queue-groups';

type Request = Model<'RequestView'>;
type Handoff = Model<'HandoffView'>;
type Asset = Model<'AssetView'>;
type Incident = Model<'IncidentView'>;

/** Search appears only once the page holds more than this many rows. */
export const SEARCH_THRESHOLD = 10;

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

/**
 * Requests and handoffs: the open ones, or every one for history. The keys keep the shape the
 * field pending list shares, `[company, 'handoffs', all, warehouse]`.
 */
function useMovements(all: boolean, enabled = true) {
  const c = useCompany();
  const requests = useQuery({
    queryKey: [c.company_id, 'requests', all, ''],
    enabled,
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/tool-requests', {
            params: { path: c.path, query: { offset, pending: !all } },
          })
          .then(result),
      ),
  });
  const handoffs = useQuery({
    queryKey: [c.company_id, 'handoffs', all, ''],
    enabled,
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/handoffs', {
            params: { path: c.path, query: { offset, pending: !all } },
          })
          .then(result),
      ),
  });
  return { requests, handoffs };
}

const caseSentences: Record<string, (tool: string) => string> = {
  custody_dispute: (tool) => `Nobody agrees who has the ${tool}`,
  missing_asset: (tool) => `The ${tool} can't be found`,
  duplicate_asset: (tool) => `The ${tool} may be listed twice`,
};

/** An open record that needs fixing, linked to the page that fixes it. */
export interface RecordToFix {
  id: string;
  assetId: string;
  toolName: string;
  title: string;
  note: string;
  at: string;
  to: string;
}

/** A damaged or lost tool the viewer answers for, linked to its decisions. */
export interface FlaggedEntry {
  assetId: string;
  toolName: string;
  title: string;
  note: string;
  at: string | null;
  to: string;
}

function flaggedTitle(asset: Asset, latest: Incident | undefined) {
  if (asset.missing || latest?.kind === 'missing')
    return latest ? `${latest.reported_by_name} reported the ${asset.name} lost` : `The ${asset.name} is lost`;
  if (latest) return `${latest.reported_by_name} reported the ${asset.name} damaged`;
  return asset.serviceability === 'out_of_service'
    ? `The ${asset.name} is out of service`
    : `The ${asset.name} is damaged`;
}

/** Everything the queue page shows: what needs the viewer, what waits on others, and history. */
export function useOperationsPageState() {
  const c = useCompany();
  const location = useLocation();
  const list = useListLocation();
  const review = list.params.get('review') ?? '';
  const search = list.params.get('search') ?? '';
  const history = list.params.get('history') === 'true';
  const refs = useReferences();
  const live = useMovements(false);
  const past = useMovements(true, history);
  const flagged = useFlaggedTools();
  const recordsAllowed = c.can('reconciliation.manage');
  const cases = useQuery({
    queryKey: [c.company_id, 'cases', 'queue'],
    enabled: recordsAllowed,
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/reconciliations', {
            params: { path: c.path, query: { offset, open_only: true } },
          })
          .then(result),
      ),
  });
  const requests = live.requests.data ?? [];
  const handoffs = live.handoffs.data ?? [];
  const pastRequests = past.requests.data ?? [];
  const pastHandoffs = past.handoffs.data ?? [];
  const openCases = recordsAllowed ? (cases.data ?? []) : [];
  const asset = useAssetLookup(
    [...requests, ...handoffs, ...pastRequests, ...pastHandoffs, ...openCases].map((item) => item.asset_id),
  );
  const permissions = useQueuePermissions();
  const names: QueueNames = {
    tool: (id) => asset(id)?.name ?? 'tool',
    warehouse: (id) => refs.warehouse(id),
  };
  const viewer = {
    membershipId: c.membership_id,
    managesAll: c.can('tools.manage'),
    managedWarehouseIds: c.managed_warehouse_ids,
  };
  const groups = groupQueue(requests, handoffs, viewer, names, permissions);

  const flaggedEntries: FlaggedEntry[] = flagged.rows
    .filter((row) => row.policy.canEdit)
    .map(({ asset: tool, incidents }) => {
      const latest = incidents.at(-1);
      return {
        assetId: tool.id,
        toolName: tool.name,
        title: flaggedTitle(tool, latest),
        note: latest?.description ?? '',
        at: latest?.reported_at ?? null,
        to: `/app/flagged/${tool.id}`,
      };
    });
  const records: RecordToFix[] = openCases.map((item) => {
    const tool = names.tool(item.asset_id);
    const sentence = caseSentences[item.kind] ?? ((name: string) => `The ${name} record needs fixing`);
    return {
      id: item.id,
      assetId: item.asset_id,
      toolName: tool,
      title: sentence(tool),
      note: item.narrative,
      at: item.opened_at,
      to: `/app/reconciliations?resolve=${item.id}`,
    };
  });

  const total = groups.needsYou.length + groups.waiting.length + flaggedEntries.length + records.length;
  const searchable = total > SEARCH_THRESHOLD || !!search;
  const query = searchable ? search.trim().toLocaleLowerCase() : '';
  const matches = (...parts: string[]) => !query || parts.join(' ').toLocaleLowerCase().includes(query);
  const visible = (entry: QueueEntry) => matches(entry.title, entry.status, entry.note, entry.toolName);
  const historyEntries = history
    ? queueHistory(pastRequests, pastHandoffs, names).filter((entry) =>
        matches(entry.title, entry.outcome, entry.note, entry.toolName),
      )
    : [];

  // Deep links (`?review=request:<id>` / `?review=handoff:<id>`) open from any loaded record.
  const allRequests = [...requests, ...pastRequests];
  const allHandoffs = [...handoffs, ...pastHandoffs];
  const [reviewKind, reviewId] = review.split(':');
  const reviewRequest = reviewKind === 'request' ? allRequests.find((item) => item.id === reviewId) : undefined;
  const reviewHandoff = reviewKind === 'handoff' ? allHandoffs.find((item) => item.id === reviewId) : undefined;
  const reviewed = reviewRequest ?? reviewHandoff;

  return {
    c,
    loaded:
      live.requests.data !== undefined &&
      live.handoffs.data !== undefined &&
      !flagged.tools.isPending &&
      !flagged.incidents.isPending &&
      (!recordsAllowed || !cases.isPending),
    error: live.requests.error ?? live.handoffs.error,
    retry: () => {
      void live.requests.refetch();
      void live.handoffs.refetch();
    },
    needsYou: groups.needsYou.filter(visible),
    waiting: groups.waiting.filter(visible),
    flagged: flaggedEntries.filter((entry) => matches(entry.title, entry.note, entry.toolName)),
    records: records.filter((entry) => matches(entry.title, entry.note, entry.toolName)),
    /** Where a damaged or lost tool's sheet returns to when closed. */
    returnTo: location.pathname + location.search,
    nothingNeedsYou: groups.needsYou.length + flaggedEntries.length + records.length === 0,
    searchable,
    search,
    setSearch: (value: string) => list.update('search', value),
    history,
    historyLoading: history && (past.requests.isPending || past.handoffs.isPending),
    historyError: history && (past.requests.isError || past.handoffs.isError),
    historyEntries,
    setHistory: (value: boolean) => list.update('history', value ? 'true' : ''),
    photo: (assetId: string) => asset(assetId)?.registration_photo_id ?? null,
    asset,
    reviewRequest,
    reviewHandoff,
    reviewEntry: [...groups.needsYou, ...groups.waiting].find((entry) => entry.key === review),
    reviewTool: reviewed ? names.tool(reviewed.asset_id) : '',
    /** The request a pickup handoff fulfils, so its requester can still withdraw it. */
    reviewPickupRequest: reviewHandoff?.tool_request_id
      ? allRequests.find((item) => item.id === reviewHandoff.tool_request_id)
      : undefined,
    review,
    openReview: (key: string) => list.update('review', key),
  };
}

/** Who may do what with a pending request or handoff, from the live permission rules. */
export function useQueuePermissions() {
  const c = useCompany();
  return queuePermissions({
    membershipId: c.membership_id,
    managesAll: c.can('tools.manage'),
    managedWarehouseIds: c.managed_warehouse_ids,
  });
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
