import { formatActivityTimestamp } from '../../domain/activity';
import type { ActivityView } from '../../domain/read-models/activity';
import type { MockState } from './mock-state';

export const toActivityView = (state: MockState, eventId: string): ActivityView => {
  const event = state.events.find((candidate) => candidate.id === eventId);
  if (!event) throw new Error('Audit event not found: ' + eventId);
  if (!event.toolUnitId) throw new Error('Tool activity requires a tool unit: ' + event.id);
  const actor = state.users.find((user) => user.id === event.actorId);
  const tool = state.units.find((unit) => unit.id === event.toolUnitId);
  const definition = tool && state.definitions.find((candidate) => candidate.id === tool.definitionId);
  const warehouse = tool && state.warehouses.find((candidate) => candidate.id === tool.originWarehouseId);
  if (!tool || !definition || !warehouse) throw new Error('Activity projection is incomplete: ' + event.id);
  const eventWarehouse = event.warehouseId
    ? state.warehouses.find((candidate) => candidate.id === event.warehouseId)
    : undefined;
  if (!eventWarehouse) throw new Error('Activity event requires a warehouse: ' + event.id);
  return {
    id: event.id,
    actorId: event.actorId,
    actor: actor?.name ?? 'Unknown user',
    action: event.action,
    toolUnitId: event.toolUnitId,
    toolName: definition.name,
    imageSrc: './tool-images/' + (tool.photoKey ?? definition.imageKey),
    time: formatActivityTimestamp(event.occurredAt),
    kind: event.kind,
    warehouseId: eventWarehouse.id,
    warehouseName: eventWarehouse.name,
    timestamp: event.occurredAt,
    scope: event.scope,
    participantIds: [...event.participantIds],
    ...(event.evidence ? { evidence: { ...event.evidence } } : {}),
  };
};
