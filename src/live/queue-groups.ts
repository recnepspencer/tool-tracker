import type { Model } from './client';

type Request = Model<'RequestView'>;
type Handoff = Model<'HandoffView'>;
type Asset = Model<'AssetView'>;

/** Who is looking at the queue, and which warehouses they answer for. */
export interface QueueViewer {
  membershipId: string;
  /** Managers answer for every warehouse; anyone else for the warehouses they were made a manager of. */
  managesAll: boolean;
  managedWarehouseIds: readonly string[];
}

/** Display names the grouping needs but does not own. */
export interface QueueNames {
  tool(assetId: string): string;
  warehouse(warehouseId: string): string;
}

export type QueueAction = 'approve' | 'reject' | 'withdraw' | 'accept' | 'decline' | 'cancel';
/**
 * request: someone asked a warehouse for a tool. pickup: a released tool waiting for the requester.
 * return: a tool going into a warehouse. transfer: a tool going to a person.
 */
export type QueueKind = 'request' | 'pickup' | 'return' | 'transfer';

export interface QueueEntry {
  /** The `review` search-param value: `request:<id>` or `handoff:<id>`. */
  key: string;
  kind: QueueKind;
  assetId: string;
  toolName: string;
  /** What is being asked, in one plain sentence. */
  title: string;
  /** Who it waits on, or why the viewer can only decline. */
  status: string;
  note: string;
  /** When it was asked (ISO). */
  at: string;
  /** Inline buttons: the decline-like one first, the primary one last. */
  actions: QueueAction[];
  request?: Request;
  handoff?: Handoff;
}

export interface QueueGroups {
  needsYou: QueueEntry[];
  waiting: QueueEntry[];
}

/** The live permission rules for requests and handoffs, mirroring backend/equipment. */
export function queuePermissions(viewer: QueueViewer) {
  const authority = (id: string | null | undefined) =>
    !!id && (viewer.managesAll || viewer.managedWarehouseIds.includes(id));
  return {
    authority,
    request: (request: Request) => {
      const open = request.status === 'pending' || request.status === 'approved';
      const manages = authority(request.source_warehouse_id);
      return {
        approve: request.status === 'pending' && manages && request.requester_eligible,
        reject: open && manages,
        withdraw: open && request.requester_id === viewer.membershipId,
      };
    },
    handoff: (handoff: Handoff, asset: Pick<Asset, 'responsible_warehouse_id'> | undefined) => {
      const open = handoff.status === 'pending';
      const receiving =
        handoff.destination_membership_id === viewer.membershipId || authority(handoff.destination_warehouse_id);
      return {
        receiving: open && receiving,
        cancelling: open && handoff.proposed_by_id === viewer.membershipId,
        voidAllowed: open && authority(handoff.source_warehouse_id ?? asset?.responsible_warehouse_id),
      };
    },
  };
}

export type QueuePermissions = ReturnType<typeof queuePermissions>;

const byOldest = (a: QueueEntry, b: QueueEntry) => a.at.localeCompare(b.at);

/**
 * Splits the open requests and handoffs into what needs the viewer and what waits on someone else.
 * A released request is shown as its pickup handoff, which is what still needs doing.
 */
export function groupQueue(
  requests: readonly Request[],
  handoffs: readonly Handoff[],
  viewer: QueueViewer,
  names: QueueNames,
  permissions: QueuePermissions = queuePermissions(viewer),
): QueueGroups {
  const me = viewer.membershipId;
  const needsYou: QueueEntry[] = [];
  const waiting: QueueEntry[] = [];
  const pendingHandoffs = handoffs.filter((handoff) => handoff.status === 'pending');
  const pickupFor = new Map(
    pendingHandoffs.filter((handoff) => handoff.tool_request_id).map((handoff) => [handoff.tool_request_id, handoff]),
  );
  const requestsById = new Map(requests.map((request) => [request.id, request]));

  for (const request of requests) {
    if (request.status === 'approved' && pickupFor.has(request.id)) continue;
    if (request.status !== 'pending' && request.status !== 'approved') continue;
    const tool = names.tool(request.asset_id);
    const from = request.source_warehouse_id ? names.warehouse(request.source_warehouse_id) : 'its holder';
    const mine = request.requester_id === me;
    const allowed = permissions.request(request);
    const base = {
      key: `request:${request.id}`,
      kind: 'request' as const,
      assetId: request.asset_id,
      toolName: tool,
      note: request.note,
      at: request.requested_at,
      request,
    };
    if (request.status === 'pending' && allowed.reject) {
      needsYou.push({
        ...base,
        title: mine
          ? `You asked for the ${tool} from ${from}`
          : `${request.requester_name} wants the ${tool} from ${from}`,
        status: request.requester_eligible ? '' : `${request.requester_name} can no longer take tools`,
        actions: allowed.approve ? ['reject', 'approve'] : ['reject'],
      });
      continue;
    }
    // Released, but its pickup is not in view: it still waits on the requester.
    const released = request.status === 'approved';
    waiting.push({
      ...base,
      title: mine
        ? `You asked for the ${tool} from ${from}`
        : `${request.requester_name} wants the ${tool} from ${from}`,
      status: released
        ? `Waiting for ${mine ? 'you' : request.requester_name} to pick up`
        : `Waiting for ${from} to release it`,
      actions: allowed.withdraw ? ['withdraw'] : [],
    });
  }

  for (const handoff of pendingHandoffs) {
    const tool = names.tool(handoff.asset_id);
    const allowed = permissions.handoff(handoff, undefined);
    const fromWarehouse = handoff.source_warehouse_id ? names.warehouse(handoff.source_warehouse_id) : '';
    const proposer = handoff.proposed_by_id === me ? 'You' : handoff.proposed_by_name;
    const destination = handoff.destination_name;
    const toPerson = !!handoff.destination_membership_id;
    const toMe = handoff.destination_membership_id === me;
    const request = handoff.tool_request_id ? requestsById.get(handoff.tool_request_id) : undefined;
    const pickup = !!handoff.tool_request_id && toPerson;
    const kind: QueueKind = pickup ? 'pickup' : toPerson ? 'transfer' : 'return';
    const entry = {
      key: `handoff:${handoff.id}`,
      kind,
      assetId: handoff.asset_id,
      toolName: tool,
      note: handoff.note || request?.note || '',
      at: handoff.proposed_at,
      handoff,
      ...(request ? { request } : {}),
    };
    if (allowed.receiving) {
      let title: string;
      if (pickup) title = `The ${tool} from ${fromWarehouse || proposer} is ready for you`;
      else if (toPerson)
        title = fromWarehouse
          ? `${proposer} is sending you the ${tool} from ${fromWarehouse}`
          : `${proposer} ${proposer === 'You' ? 'are' : 'is'} handing you the ${tool}`;
      else if (fromWarehouse)
        title = `${proposer} ${proposer === 'You' ? 'are' : 'is'} moving the ${tool} from ${fromWarehouse} to ${destination}`;
      else title = `${proposer} ${proposer === 'You' ? 'are' : 'is'} returning the ${tool} to ${destination}`;
      needsYou.push({ ...entry, title, status: '', actions: ['decline', 'accept'] });
      continue;
    }
    let title: string;
    if (pickup) title = `${fromWarehouse || proposer} released the ${tool} to ${toMe ? 'you' : destination}`;
    else if (toPerson)
      title =
        proposer === 'You'
          ? `You're handing ${destination} the ${tool}`
          : fromWarehouse
            ? `${proposer} is sending ${destination} the ${tool} from ${fromWarehouse}`
            : `${proposer} is handing ${destination} the ${tool}`;
    else if (fromWarehouse)
      title =
        proposer === 'You'
          ? `You're moving the ${tool} from ${fromWarehouse} to ${destination}`
          : `${proposer} is moving the ${tool} from ${fromWarehouse} to ${destination}`;
    else
      title =
        proposer === 'You'
          ? `You're returning the ${tool} to ${destination}`
          : `${proposer} is returning the ${tool} to ${destination}`;
    waiting.push({
      ...entry,
      title,
      status: pickup ? `Waiting for ${destination} to pick up` : `Waiting for ${destination} to accept`,
      actions: allowed.cancelling ? ['cancel'] : [],
    });
  }

  return { needsYou: needsYou.sort(byOldest), waiting: waiting.sort(byOldest) };
}

export interface HistoryEntry {
  key: string;
  assetId: string;
  toolName: string;
  title: string;
  outcome: string;
  note: string;
  at: string;
  request?: Request;
  handoff?: Handoff;
}

const requestOutcomes: Partial<Record<Request['status'], string>> = {
  rejected: 'Declined',
  withdrawn: 'Withdrawn',
  fulfilled: 'Picked up',
};
const handoffOutcomes: Partial<Record<Handoff['status'], string>> = {
  accepted: 'Accepted',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

/**
 * Recent decisions, newest first. A pickup that fulfilled a request is told by that request,
 * so it is not listed twice.
 */
export function queueHistory(
  requests: readonly Request[],
  handoffs: readonly Handoff[],
  names: QueueNames,
  limit = 50,
): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  for (const request of requests) {
    const outcome = requestOutcomes[request.status];
    if (!outcome) continue;
    const tool = names.tool(request.asset_id);
    const from = request.source_warehouse_id ? names.warehouse(request.source_warehouse_id) : 'its holder';
    entries.push({
      key: `request:${request.id}`,
      assetId: request.asset_id,
      toolName: tool,
      title: `${request.requester_name} asked for the ${tool} from ${from}`,
      outcome,
      note: request.decision_note,
      at: request.decided_at ?? request.requested_at,
      request,
    });
  }
  for (const handoff of handoffs) {
    const outcome = handoffOutcomes[handoff.status];
    if (!outcome || handoff.tool_request_id) continue;
    const tool = names.tool(handoff.asset_id);
    entries.push({
      key: `handoff:${handoff.id}`,
      assetId: handoff.asset_id,
      toolName: tool,
      title: `${handoff.proposed_by_name} sent the ${tool} to ${handoff.destination_name}`,
      outcome,
      note: handoff.resolution_note,
      at: handoff.resolved_at ?? handoff.proposed_at,
      handoff,
    });
  }
  return entries.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
