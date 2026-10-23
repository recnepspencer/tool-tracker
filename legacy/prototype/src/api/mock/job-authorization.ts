import { WorkflowError } from '../../domain/workflow-error';
import type { MockState } from './mock-state';

export const requireJobActor = (state: MockState, actorId: string, workerOnly = false) => {
  const actor = state.users.find((member) => member.id === actorId);
  if (!actor || actor.lifecycle !== 'active' || (actor.role !== 'worker' && (workerOnly || actor.role !== 'admin'))) {
    throw new WorkflowError(
      'forbidden',
      workerOnly ? 'An active foreman is required' : 'An active foreman or administrator is required',
    );
  }
  return actor;
};
