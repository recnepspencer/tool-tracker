import { WorkflowError } from '../../domain/workflow-error';
import type { Member } from '../../domain/people';
import type { MockDatabaseState, SeedSnapshot, DeepReadonly } from './seed-state';

export function userOrThrow(state: MockDatabaseState, userId: string): Member;
export function userOrThrow(state: SeedSnapshot, userId: string): DeepReadonly<Member>;
export function userOrThrow(state: SeedSnapshot, userId: string): Member | DeepReadonly<Member> {
  const user = state.users.find((candidate) => candidate.id === userId);
  if (!user) throw new WorkflowError('forbidden', 'Unknown actor: ' + userId);
  return user;
}
