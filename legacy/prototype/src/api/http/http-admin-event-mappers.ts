import { ACTIVITY_KINDS, ACTIVITY_SCOPES, formatActivityTimestamp } from '../../domain/activity';
import type { AuditEventView } from '../../domain/read-models/activity';
import type { AdminHeldToolView } from '../../domain/read-models/admin';
import type { EventDto, HeldToolDto } from './http-admin-types';
import { mapEvidenceDto } from './http-evidence';
import {
  knownEventPerson,
  knownTool,
  knownWarehouse,
  type EventReferences,
  type ToolReferences,
  type WarehouseReferences,
} from './http-admin-references';
import { instantValue, nonBlankStringValue, oneOf } from './http-validation';

export const mapEvent = (event: EventDto, references?: EventReferences): AuditEventView => {
  const timestamp = instantValue(event.occurred_at, 'event time');
  const actorId = nonBlankStringValue(event.actor_id, 'event actor id');
  const actor = nonBlankStringValue(event.actor_name, 'event actor');
  const toolUnitId =
    event.tool_unit_id === undefined ? undefined : nonBlankStringValue(event.tool_unit_id, 'event tool id');
  const toolName = event.tool_name === undefined ? undefined : nonBlankStringValue(event.tool_name, 'event tool');
  const warehouseId =
    event.warehouse_id === undefined ? undefined : nonBlankStringValue(event.warehouse_id, 'event warehouse id');
  const warehouseName =
    event.warehouse_name === undefined ? undefined : nonBlankStringValue(event.warehouse_name, 'event warehouse');
  const kind = oneOf(event.kind, ACTIVITY_KINDS, 'event kind');
  const scope = event.scope === undefined ? undefined : oneOf(event.scope, ACTIVITY_SCOPES, 'event scope');
  const evidence = mapEvidenceDto(event.evidence, 'event evidence');
  if (
    (toolUnitId === undefined) !== (toolName === undefined) ||
    (toolUnitId === undefined && (kind !== 'admin' || (scope !== undefined && scope !== 'admin')))
  ) {
    throw new Error('Invalid API response: event tool reference');
  }
  knownEventPerson(references?.people, actorId, actor);
  if (toolUnitId !== undefined && toolName !== undefined) knownTool(references?.tools, toolUnitId, toolName);
  if ((warehouseId === undefined) !== (warehouseName === undefined)) {
    throw new Error('Invalid API response: event warehouse reference');
  }
  if (toolUnitId !== undefined && (warehouseId === undefined || warehouseName === undefined)) {
    throw new Error('Invalid API response: event warehouse reference');
  }
  if (warehouseId !== undefined && warehouseName !== undefined) {
    knownWarehouse(references?.warehouses, warehouseId, warehouseName, 'event warehouse');
  }
  return {
    id: nonBlankStringValue(event.event_id, 'event id'),
    actorId,
    actor,
    action: nonBlankStringValue(event.action, 'event action'),
    ...(toolUnitId === undefined ? {} : { toolUnitId }),
    ...(toolName === undefined ? {} : { toolName }),
    ...(warehouseId === undefined || warehouseName === undefined ? {} : { warehouseId, warehouseName }),
    time: formatActivityTimestamp(timestamp),
    timestamp,
    kind,
    scope:
      scope ?? (kind === 'flag' ? 'damage' : kind === 'request' ? 'worker' : kind === 'custody' ? 'worker' : 'admin'),
    ...(evidence ? { evidence } : {}),
  };
};

export const mapHeldTool = (
  dto: HeldToolDto,
  warehouses?: WarehouseReferences,
  tools?: ToolReferences,
): AdminHeldToolView => {
  const holderSinceAt = instantValue(dto.holder_since_at, 'held tool time');
  const holderSince = nonBlankStringValue(dto.holder_since, 'held tool display time');
  if (holderSince !== formatActivityTimestamp(holderSinceAt)) throw new Error('Invalid API response: held tool time');
  const warehouseId = nonBlankStringValue(dto.warehouse_id, 'held tool warehouse id');
  const warehouseName = nonBlankStringValue(dto.warehouse_name, 'held tool warehouse');
  knownWarehouse(warehouses, warehouseId, warehouseName, 'held tool warehouse');
  const toolUnitId = nonBlankStringValue(dto.tool_unit_id, 'held tool id');
  const toolName = nonBlankStringValue(dto.tool_name, 'held tool name');
  knownTool(tools, toolUnitId, toolName, 'held tool');
  return {
    toolUnitId,
    toolName,
    holderSince,
    holderSinceAt,
    warehouseId,
    warehouseName,
    status: oneOf(dto.status, ['checked-out', 'damaged', 'lost'] as const, 'held tool status'),
  };
};
