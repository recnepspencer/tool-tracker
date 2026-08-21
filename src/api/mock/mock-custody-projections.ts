import type { PendingHandoffView } from '../../domain/read-models/custody';
import { formatActivityTimestamp } from '../../domain/activity';
import { pendingHandoffActions, pendingHandoffDirection } from '../../domain/custody-policy';
import { toHolderView } from './mock-holder-projection';
import { toToolView } from './mock-tool-projections';
import type { MockState } from './mock-state';

export const toPendingHandoffView = (state: MockState, handoffId: string, profileId: string): PendingHandoffView => {
  const handoff = state.handoffs.find((candidate) => candidate.id === handoffId);
  if (!handoff) throw new Error('Handoff not found: ' + handoffId);
  const tool = toToolView(state, handoff.toolUnitId);
  const userNames = new Map(state.users.map((user) => [user.id, user.name]));
  const warehouseNames = new Map(state.warehouses.map((warehouse) => [warehouse.id, warehouse.name]));
  const isIncomingTransfer = pendingHandoffDirection(handoff, profileId) === 'incoming';
  return {
    id: handoff.id,
    kind: handoff.kind,
    toolUnitId: handoff.toolUnitId,
    toolName: tool.name,
    imageSrc: tool.imageSrc,
    from: toHolderView(handoff.from, userNames, warehouseNames),
    to: toHolderView(handoff.to, userNames, warehouseNames),
    requestedById: handoff.requestedBy,
    requestedBy: state.users.find((user) => user.id === handoff.requestedBy)?.name ?? 'Unknown user',
    requestedAt: formatActivityTimestamp(handoff.requestedAt),
    requestedAtInstant: handoff.requestedAt,
    ...(handoff.evidence ? { evidence: { ...handoff.evidence } } : {}),
    direction: isIncomingTransfer ? 'incoming' : 'outgoing',
    allowedActions: pendingHandoffActions(handoff, profileId),
  };
};
