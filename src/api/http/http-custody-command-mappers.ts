import type { CustodyMutationResult } from '../contracts/custody-api';
import { CUSTODY_MUTATION_STATUSES } from '../../domain/custody';
import type { CustodyMutationDto } from './http-custody-command-types';
import { nonBlankStringValue, oneOf } from './http-validation';

export type CustodyMutationOperation =
  'request' | 'start-transfer' | 'edit-transfer' | 'accept' | 'decline' | 'cancel' | 'withdraw' | 'report-condition';

const mutationContracts: Record<
  CustodyMutationOperation,
  { status: CustodyMutationResult['status']; handoff: boolean }
> = {
  request: { status: 'pending', handoff: true },
  'start-transfer': { status: 'pending', handoff: true },
  'edit-transfer': { status: 'pending', handoff: true },
  accept: { status: 'accepted', handoff: true },
  decline: { status: 'declined', handoff: true },
  cancel: { status: 'cancelled', handoff: true },
  withdraw: { status: 'withdrawn', handoff: true },
  'report-condition': { status: 'reported', handoff: false },
};

export const mapCustodyMutation = (
  dto: CustodyMutationDto,
  expectedToolUnitId?: string,
  expectedHandoffId?: string,
  operation?: CustodyMutationOperation,
): CustodyMutationResult => {
  const toolUnitId = nonBlankStringValue(dto.tool_unit_id, 'mutation tool id');
  if (expectedToolUnitId !== undefined && toolUnitId !== expectedToolUnitId) {
    throw new Error('Invalid API response: mutation tool id correlation');
  }
  const handoffId =
    dto.handoff_id === undefined ? undefined : nonBlankStringValue(dto.handoff_id, 'mutation handoff id');
  const contract = operation ? mutationContracts[operation] : undefined;
  if (contract?.handoff && !handoffId) throw new Error('Invalid API response: mutation handoff id');
  if (contract && !contract.handoff && handoffId)
    throw new Error('Invalid API response: unexpected mutation handoff id');
  if (expectedHandoffId !== undefined && handoffId !== expectedHandoffId) {
    throw new Error('Invalid API response: mutation handoff correlation');
  }
  const status = oneOf(dto.status, CUSTODY_MUTATION_STATUSES, 'mutation status');
  if (contract && status !== contract.status) throw new Error('Invalid API response: mutation status for ' + operation);
  return {
    ...(handoffId ? { handoffId } : {}),
    toolUnitId,
    eventId: nonBlankStringValue(dto.event_id, 'mutation event id'),
    status,
  };
};
