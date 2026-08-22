import type { CustodyApi } from '../contracts/custody-api';
import { canSeePendingHandoff } from '../../domain/custody-policy';
import { toPendingHandoffView } from './mock-custody-projections';
import {
  acceptTransfer,
  cancelTransfer,
  declineTransfer,
  requestTool,
  startTransfer,
  updateTransfer,
  withdrawRequest,
} from './custody-mutations';
import { listTransferTargets } from './custody-queries';
import { reportToolCondition } from './condition-mutations';
import type { MockDatabase } from './mock-database';
import { isActiveMember } from '../../domain/people';

export const createMockCustodyApi = (database: MockDatabase): CustodyApi => ({
  listPendingHandoffs: async (profileId) => {
    const state = database.read();
    const profile = state.users.find((user) => user.id === profileId);
    if (!profile || profile.role !== 'worker' || !isActiveMember(profile)) return [];
    const activeUnitIds = new Set(state.units.filter((unit) => unit.lifecycle === 'active').map((unit) => unit.id));
    return state.handoffs
      .filter((handoff) => activeUnitIds.has(handoff.toolUnitId) && canSeePendingHandoff(handoff, profileId))
      .map((handoff) => toPendingHandoffView(state, handoff.id, profileId));
  },
  listTransferTargets: async ({ actorId, toolUnitId, handoffId }) =>
    listTransferTargets(database, actorId, toolUnitId, handoffId),
  requestTool: async (input) => requestTool(database, input),
  startTransfer: async (input) => startTransfer(database, input),
  updateTransfer: async (input) => updateTransfer(database, input),
  acceptTransfer: async (input) => acceptTransfer(database, input),
  declineTransfer: async (input) => declineTransfer(database, input),
  cancelTransfer: async (input) => cancelTransfer(database, input),
  withdrawRequest: async (input) => withdrawRequest(database, input),
  reportToolCondition: async (input) => reportToolCondition(database, input),
});
