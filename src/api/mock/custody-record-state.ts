import { WorkflowError } from '../../domain/workflow-error';
import type { CustodyRecord } from '../../domain/custody';
import type { MockDatabaseState, SeedSnapshot, DeepReadonly } from './seed-state';

export function custodyOrThrow(state: MockDatabaseState, toolUnitId: string): CustodyRecord;
export function custodyOrThrow(state: SeedSnapshot, toolUnitId: string): DeepReadonly<CustodyRecord>;
export function custodyOrThrow(state: SeedSnapshot, toolUnitId: string): CustodyRecord | DeepReadonly<CustodyRecord> {
  const custody = state.custody.find((record) => record.toolUnitId === toolUnitId);
  if (!custody) throw new WorkflowError('invalid', 'Custody record is missing: ' + toolUnitId);
  return custody;
}

export const pendingForUnit = (state: SeedSnapshot, toolUnitId: string) =>
  state.handoffs.find((handoff) => handoff.toolUnitId === toolUnitId && handoff.status === 'pending');
