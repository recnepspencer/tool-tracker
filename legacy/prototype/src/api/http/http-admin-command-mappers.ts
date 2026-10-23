import {
  ADMIN_MUTATION_OPERATION_VALUES,
  adminMutationCorrelation,
  adminMutationTarget,
  settingsMutationCorrelation,
  type AdminMutationOperation,
} from '../../domain/admin-mutation';
import type { AdminMutationReceipt } from '../../domain/admin-mutation';
import type { MutationReceiptDto } from './http-admin-types';
import { arrayValue, nonBlankStringValue, oneOf } from './http-validation';

/**
 * Maps command receipts at the write boundary. Read-model projections stay in
 * http-admin-mappers.ts so callers cannot accidentally mix command authority
 * into a query response mapper.
 */
export const mapMutationReceipt = (
  dto: MutationReceiptDto,
  expected?: { operation: AdminMutationOperation; personId?: string; warehouseId?: string },
): AdminMutationReceipt => {
  const eventId = nonBlankStringValue(dto.event_id, 'mutation event id');
  const correlationId = nonBlankStringValue(dto.correlation_id, 'mutation correlation id');
  const expectedCorrelation =
    adminMutationTarget(dto.operation as AdminMutationOperation) === 'settings'
      ? settingsMutationCorrelation(eventId)
      : adminMutationCorrelation(eventId);
  if (correlationId !== expectedCorrelation) throw new Error('Invalid API response: mutation correlation');
  const operation = oneOf(dto.operation, ADMIN_MUTATION_OPERATION_VALUES, 'mutation operation');
  const target = adminMutationTarget(operation);
  if (target === 'person' && dto.person_id === undefined) {
    throw new Error('Invalid API response: mutation person reference');
  }
  if (target === 'warehouse' && dto.warehouse_id === undefined) {
    throw new Error('Invalid API response: mutation warehouse reference');
  }
  if (target === 'settings' && (dto.person_id !== undefined || dto.warehouse_id !== undefined)) {
    throw new Error('Invalid API response: mutation settings reference');
  }
  if (target === 'person' && dto.warehouse_id !== undefined) {
    throw new Error('Invalid API response: mutation person reference');
  }
  if (target === 'warehouse' && dto.person_id !== undefined) {
    throw new Error('Invalid API response: mutation warehouse reference');
  }
  if (expected && operation !== expected.operation) {
    throw new Error('Invalid API response: mutation operation');
  }
  if (expected?.personId !== undefined && dto.person_id !== expected.personId) {
    throw new Error('Invalid API response: mutation person reference');
  }
  if (expected?.warehouseId !== undefined && dto.warehouse_id !== expected.warehouseId) {
    throw new Error('Invalid API response: mutation warehouse reference');
  }
  const affectedToolUnitIds = arrayValue<string>(dto.affected_tool_unit_ids, 'mutation tools').map((id) =>
    nonBlankStringValue(id, 'mutation tool id'),
  );
  const affectedHandoffIds = arrayValue<string>(dto.affected_handoff_ids, 'mutation handoffs').map((id) =>
    nonBlankStringValue(id, 'mutation handoff id'),
  );
  if (target === 'settings' && affectedHandoffIds.length > 0) {
    throw new Error('Invalid API response: mutation settings handoffs');
  }
  if (new Set(affectedToolUnitIds).size !== affectedToolUnitIds.length)
    throw new Error('Invalid API response: mutation tool ids');
  if (new Set(affectedHandoffIds).size !== affectedHandoffIds.length)
    throw new Error('Invalid API response: mutation handoff ids');
  return {
    operation,
    correlationId,
    eventId,
    ...(dto.person_id === undefined ? {} : { personId: nonBlankStringValue(dto.person_id, 'mutation person id') }),
    ...(dto.warehouse_id === undefined
      ? {}
      : { warehouseId: nonBlankStringValue(dto.warehouse_id, 'mutation warehouse id') }),
    affectedToolUnitIds,
    affectedHandoffIds,
  };
};
