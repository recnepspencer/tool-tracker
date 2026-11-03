import { useQueries, useQuery } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { api, result, type Model } from './client';
import { useCommandForm } from './command-state';
import { collect, useReferences } from './data';
import { useListLocation } from './list-location';
import { useCompany } from './session';
import { text } from './ui';

type Asset = Model<'AssetView'>;
type Handoff = Model<'HandoffView'>;
type ToolRequest = Model<'RequestView'>;

export type PendingAction = 'accept' | 'decline' | 'cancel' | 'withdraw' | 'approve' | 'reject' | 'void';

/** The demo's `PendingHandoffView`, built from a live handoff or tool request. */
export interface PendingItem {
  /** The `review` search-param value: `handoff:<id>` or `request:<id>`. */
  key: string;
  source: 'handoff' | 'request';
  id: string;
  revision: number;
  variant: 'request' | 'incoming' | 'outgoing';
  otherParty: string;
  toolName: string;
  asset: Asset | undefined;
  requestedAt: string;
  actions: PendingAction[];
}

export const pendingActionLabel: Record<PendingAction, string> = {
  accept: 'Accept — take custody',
  decline: 'Decline',
  cancel: 'Cancel transfer',
  withdraw: 'Withdraw request',
  approve: 'Approve request',
  reject: 'Reject request',
  void: 'Void transfer',
};

export function pendingDirectionLabel(item: PendingItem) {
  if (item.variant === 'request') return `Requested from ${item.otherParty}`;
  return item.variant === 'incoming' ? `Accept from ${item.otherParty}` : `Sent to ${item.otherParty}`;
}

export function pendingStatusLabel(item: PendingItem) {
  if (item.variant === 'request') return `Waiting for ${item.otherParty} to release it`;
  return item.variant === 'incoming'
    ? `${item.otherParty} sent this tool to you`
    : `Waiting for ${item.otherParty} to accept`;
}

const toolQuery = (companyId: string, path: { company_id: string }, asset_id: string) => ({
  queryKey: [companyId, 'tool', asset_id],
  queryFn: () =>
    api.GET('/api/companies/{company_id}/tools/{asset_id}', { params: { path: { ...path, asset_id } } }).then(result),
});

/**
 * The signed-in worker's pending handoffs and open tool requests, plus the
 * record named by the `review` search param when it is not one of them (for
 * example an administrator opening a handoff from a tool sheet).
 */
export function usePendingMovements() {
  const c = useCompany();
  const refs = useReferences();
  const { params, update } = useListLocation();
  const review = params.get('review') ?? '';
  const [reviewSource, reviewId = ''] = review.split(':');
  const handoffs = useQuery({
    queryKey: [c.company_id, 'field-handoffs'],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/handoffs', {
            params: { path: c.path, query: { offset, pending: true, mine: true } },
          })
          .then(result),
      ),
  });
  const requests = useQuery({
    queryKey: [c.company_id, 'field-requests'],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/tool-requests', {
            params: { path: c.path, query: { offset, pending: true, mine: true } },
          })
          .then(result),
      ),
  });
  const handoffMissing =
    reviewSource === 'handoff' && !!reviewId && !!handoffs.data && !handoffs.data.some((h) => h.id === reviewId);
  const requestMissing =
    reviewSource === 'request' && !!reviewId && !!requests.data && !requests.data.some((r) => r.id === reviewId);
  const otherHandoffs = useQuery({
    queryKey: [c.company_id, 'handoffs', false, ''],
    enabled: handoffMissing,
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/handoffs', { params: { path: c.path, query: { offset, pending: true } } })
          .then(result),
      ),
  });
  const otherRequest = useQuery({
    queryKey: [c.company_id, 'request', reviewId],
    enabled: requestMissing,
    queryFn: () =>
      api
        .GET('/api/companies/{company_id}/tool-requests/{request_id}', {
          params: { path: { ...c.path, request_id: reviewId } },
        })
        .then(result),
  });
  const extraHandoff = handoffMissing ? otherHandoffs.data?.find((h) => h.id === reviewId) : undefined;
  const extraRequest =
    requestMissing && otherRequest.data && ['pending', 'approved'].includes(otherRequest.data.status)
      ? otherRequest.data
      : undefined;
  const allHandoffs = [...(handoffs.data ?? []), ...(extraHandoff ? [extraHandoff] : [])];
  const allRequests = [...(requests.data ?? []), ...(extraRequest ? [extraRequest] : [])];
  const assetIds = [...new Set([...allHandoffs, ...allRequests].map((item) => item.asset_id))];
  const assets = useQueries({ queries: assetIds.map((id) => toolQuery(c.company_id, c.path, id)) });
  const asset = (id: string) => assets.find((query) => query.data?.id === id)?.data;
  const authority = (warehouse: string | null | undefined) =>
    !!warehouse && (c.can('tools.manage') || c.managed_warehouse_ids.includes(warehouse));

  const fromHandoff = (h: Handoff): PendingItem => {
    const tool = asset(h.asset_id);
    const receiving = h.destination_membership_id === c.membership_id || authority(h.destination_warehouse_id);
    const cancelling = h.proposed_by_id === c.membership_id;
    const voidAllowed = authority(h.source_warehouse_id ?? tool?.responsible_warehouse_id);
    const actions: PendingAction[] = [];
    if (receiving) actions.push('accept', 'decline');
    if (cancelling) actions.push('cancel');
    // Void is the administrator's way out when they are neither party.
    if (voidAllowed && !receiving && !cancelling) actions.push('void');
    return {
      key: `handoff:${h.id}`,
      source: 'handoff',
      id: h.id,
      revision: h.revision,
      variant: receiving ? 'incoming' : 'outgoing',
      otherParty: receiving ? (tool?.holder_name ?? tool?.warehouse_name ?? h.proposed_by_name) : h.destination_name,
      toolName: tool?.name ?? 'Loading tool…',
      asset: tool,
      requestedAt: h.proposed_at,
      actions,
    };
  };
  const fromRequest = (r: ToolRequest): PendingItem => {
    const tool = asset(r.asset_id);
    const manages = authority(r.source_warehouse_id);
    const actions: PendingAction[] = [];
    if (r.requester_id === c.membership_id) actions.push('withdraw');
    if (manages && r.requester_eligible && r.status === 'pending') actions.push('approve');
    if (manages) actions.push('reject');
    return {
      key: `request:${r.id}`,
      source: 'request',
      id: r.id,
      revision: r.revision,
      variant: 'request',
      otherParty: r.source_warehouse_id
        ? (tool?.warehouse_name ?? refs.warehouse(r.source_warehouse_id))
        : (tool?.holder_name ?? 'the current holder'),
      toolName: tool?.name ?? 'Loading tool…',
      asset: tool,
      requestedAt: r.requested_at,
      actions,
    };
  };

  // An approved request continues as a handoff; show that handoff, not both.
  const handedOff = new Set(allHandoffs.map((h) => h.tool_request_id).filter(Boolean));
  const items = [...allHandoffs.map(fromHandoff), ...allRequests.filter((r) => !handedOff.has(r.id)).map(fromRequest)];
  const listed = (item: PendingItem) =>
    item.key !== `handoff:${extraHandoff?.id}` && item.key !== `request:${extraRequest?.id}`;
  const visible = items.filter(listed);
  return {
    c,
    isPending: handoffs.isPending || requests.isPending,
    error: handoffs.error ?? requests.error,
    retry: () => {
      void handoffs.refetch();
      void requests.refetch();
    },
    needsResponse: visible.filter((item) => item.variant === 'incoming'),
    waiting: visible.filter((item) => item.variant !== 'incoming'),
    pendingAssetIds: new Set((handoffs.data ?? []).map((h) => h.asset_id)),
    reviewing: items.find((item) => item.key === review && item.actions.length > 0),
    openReview: (key: string) => update('review', key, false),
    closeReview: () => update('review', '', false),
  };
}

/** Decision state for the review sheet: the inspection gate and the command form. */
export function usePendingDecision(item: PendingItem, onDone: () => void) {
  const c = useCompany();
  const [inspected, setInspected] = useState(false);
  const chosen = useRef<PendingAction | null>(null);
  const form = useCommandForm(async (data) => {
    const action = chosen.current;
    if (!action) throw new Error('Choose what to do with this transfer.');
    const note = text(data, 'note');
    if (action === 'void' && !note) throw new Error('Add a reason before voiding this transfer.');
    const body = { expected_revision: item.revision, note };
    if (item.source === 'handoff') {
      return result(
        await api.POST('/api/companies/{company_id}/handoffs/{handoff_id}/{action}', {
          params: {
            path: { ...c.path, handoff_id: item.id, action: action as 'accept' | 'decline' | 'cancel' | 'void' },
          },
          body,
        }),
      );
    }
    return result(
      await api.POST('/api/companies/{company_id}/tool-requests/{request_id}/{action}', {
        params: { path: { ...c.path, request_id: item.id, action: action as 'approve' | 'reject' | 'withdraw' } },
        body,
      }),
    );
  }, onDone);
  return {
    ...form,
    inspected,
    toggleInspected: () => setInspected((current) => !current),
    submit: (event: FormEvent<HTMLFormElement>) => {
      const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
      chosen.current = (submitter?.value as PendingAction | undefined) ?? null;
      void form.run(event);
    },
  };
}
