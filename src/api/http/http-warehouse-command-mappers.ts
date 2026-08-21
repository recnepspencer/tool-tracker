import type { WarehouseMutationReceipt } from '../../domain/warehouse-operation';
import type { WarehouseMutationReceiptDto } from './http-warehouse-types';
import { arrayValue, nonBlankStringValue } from './http-validation';

const OPERATION_STATUS: Record<string, WarehouseMutationReceipt['operation']> = {
  'approve-request': 'approve-request',
  'accept-return': 'accept-return',
  'decline-queue-item': 'decline-queue-item',
  'return-tool': 'return-tool',
  'decommission-tool': 'decommission-tool',
};

const requiresHandoff = (operation: WarehouseMutationReceipt['operation']) =>
  operation === 'approve-request' || operation === 'accept-return' || operation === 'decline-queue-item';

const uniqueIds = (value: unknown, label: string) => {
  const ids = arrayValue<string>(value, label).map((id, index) => nonBlankStringValue(id, label + ' ' + index));
  if (new Set(ids).size !== ids.length) throw new Error('Invalid API response: ' + label + ' duplicates');
  return ids;
};

export const mapWarehouseMutation = (
  dto: WarehouseMutationReceiptDto,
  expectedOperation: WarehouseMutationReceipt['operation'],
  expectedToolUnitId?: string,
  expectedHandoffId?: string,
): WarehouseMutationReceipt => {
  const operation = OPERATION_STATUS[dto.operation];
  if (!operation || operation !== expectedOperation)
    throw new Error('Invalid API response: warehouse mutation operation');
  const eventId = nonBlankStringValue(dto.event_id, 'warehouse mutation event id');
  const toolUnitId = nonBlankStringValue(dto.tool_unit_id, 'warehouse mutation tool id');
  const handoffId =
    dto.handoff_id === undefined ? undefined : nonBlankStringValue(dto.handoff_id, 'warehouse mutation handoff id');
  if (requiresHandoff(operation) && !handoffId) throw new Error('Invalid API response: warehouse mutation handoff id');
  if (!requiresHandoff(operation) && handoffId)
    throw new Error('Invalid API response: unexpected warehouse mutation handoff id');
  if (expectedToolUnitId !== undefined && toolUnitId !== expectedToolUnitId)
    throw new Error('Invalid API response: warehouse mutation tool correlation');
  if (expectedHandoffId !== undefined && handoffId !== expectedHandoffId)
    throw new Error('Invalid API response: warehouse mutation handoff correlation');
  const affectedToolUnitIds = uniqueIds(dto.affected_tool_unit_ids, 'warehouse mutation tool ids');
  const affectedHandoffIds = uniqueIds(dto.affected_handoff_ids, 'warehouse mutation handoff ids');
  if (!affectedToolUnitIds.length) throw new Error('Invalid API response: warehouse mutation tool ids empty');
  if (!affectedToolUnitIds.includes(toolUnitId))
    throw new Error('Invalid API response: warehouse mutation tool subject');
  if (affectedToolUnitIds.length !== 1) throw new Error('Invalid API response: warehouse mutation tool ids unrelated');
  if (requiresHandoff(operation) && !affectedHandoffIds.length)
    throw new Error('Invalid API response: warehouse mutation handoff ids empty');
  if (requiresHandoff(operation) && !affectedHandoffIds.includes(handoffId!))
    throw new Error('Invalid API response: warehouse mutation handoff subject');
  if (requiresHandoff(operation) && affectedHandoffIds.length !== 1)
    throw new Error('Invalid API response: warehouse mutation handoff ids unrelated');
  if (!requiresHandoff(operation) && affectedHandoffIds.length)
    throw new Error('Invalid API response: unexpected warehouse mutation handoff ids');
  if (dto.correlation_id !== 'WH-' + eventId) throw new Error('Invalid API response: warehouse mutation correlation');
  return {
    operation,
    correlationId: dto.correlation_id,
    eventId,
    toolUnitId,
    ...(handoffId ? { handoffId } : {}),
    affectedToolUnitIds,
    affectedHandoffIds,
  };
};
