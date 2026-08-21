import { isAdminMember } from '../../domain/people';
import { WorkflowError } from '../../domain/workflow-error';
import type { MockState } from './mock-state';

export const requireAdminActor = (state: MockState, actorId: string) => {
  const actor = state.users.find((user) => user.id === actorId);
  if (!actor || !isAdminMember(actor)) {
    throw new WorkflowError('forbidden', 'An active administrator is required');
  }
  return actor;
};
