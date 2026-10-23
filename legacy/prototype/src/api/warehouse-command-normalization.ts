import type { WarehouseHandoffCommandInput, WarehouseToolCommandInput } from './contracts/warehouse-api';
import { normalizeEvidence, normalizeExpectedRevision } from './command-normalization';

export const normalizeWarehouseHandoffCommandInput = (
  input: WarehouseHandoffCommandInput,
): WarehouseHandoffCommandInput =>
  normalizeEvidence({
    ...input,
    actorId: input.actorId.trim(),
    handoffId: input.handoffId.trim(),
    toolUnitId: input.toolUnitId.trim(),
  });

export const normalizeWarehouseToolCommandInput = (input: WarehouseToolCommandInput): WarehouseToolCommandInput =>
  normalizeEvidence({
    ...input,
    actorId: input.actorId.trim(),
    toolUnitId: input.toolUnitId.trim(),
    expectedRevision: normalizeExpectedRevision(input.expectedRevision),
  });
