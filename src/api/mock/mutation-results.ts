import type { CustodyMutationResult } from '../contracts/custody-api';
import type { CustodyMutationStatus } from '../../domain/custody';

export const toCustodyMutationResult = (
  toolUnitId: string,
  eventId: string,
  status: CustodyMutationStatus,
  handoffId?: string,
): CustodyMutationResult => ({
  ...(handoffId ? { handoffId } : {}),
  toolUnitId,
  eventId,
  status,
});
