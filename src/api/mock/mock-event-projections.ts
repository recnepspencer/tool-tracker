import { formatActivityTimestamp } from '../../domain/activity';
import type { AuditEventView } from '../../domain/read-models/activity';
import type { MockState } from './mock-state';

export const toEventView = (state: MockState, eventId: string): AuditEventView => {
  const event = state.events.find((candidate) => candidate.id === eventId);
  if (!event) throw new Error('Audit event not found: ' + eventId);
  const actor = state.users.find((user) => user.id === event.actorId);
  const definition = event.toolUnitId
    ? state.units.find((unit) => unit.id === event.toolUnitId)?.definitionId
    : undefined;
  const toolName = definition ? state.definitions.find((candidate) => candidate.id === definition)?.name : undefined;
  return {
    id: event.id,
    actorId: event.actorId,
    actor: actor?.name ?? 'Unknown user',
    action: event.action,
    ...(event.toolUnitId ? { toolUnitId: event.toolUnitId } : {}),
    ...(toolName ? { toolName } : {}),
    ...(event.warehouseId
      ? {
          warehouseId: event.warehouseId,
          warehouseName:
            state.warehouses.find((warehouse) => warehouse.id === event.warehouseId)?.name ?? 'Unknown warehouse',
        }
      : {}),
    time: formatActivityTimestamp(event.occurredAt),
    timestamp: event.occurredAt,
    kind: event.kind,
    scope: event.scope,
    ...(event.evidence ? { evidence: { ...event.evidence } } : {}),
  };
};
