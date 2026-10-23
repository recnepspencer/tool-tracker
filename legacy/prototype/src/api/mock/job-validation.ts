import { parseCanonicalInstant } from '../../domain/activity';
import { normalizeJobName } from '../../domain/jobs';
import type { MockDatabaseState } from './seed-state';

export const assertJobs = (state: MockDatabaseState) => {
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const job of state.jobs) {
    const name = normalizeJobName(job.name);
    if (
      !job.id ||
      ids.has(job.id) ||
      !name ||
      name !== job.name ||
      names.has(name.toLowerCase()) ||
      !Number.isSafeInteger(job.revision) ||
      job.revision < 1 ||
      (job.archivedAt !== undefined && parseCanonicalInstant(job.archivedAt) === null)
    )
      throw new Error('Invalid job: ' + job.id);
    ids.add(job.id);
    names.add(name.toLowerCase());
  }
  const assignmentIds = new Set<string>();
  const memberships = new Set<string>();
  for (const assignment of state.jobAssignments) {
    const job = state.jobs.find((item) => item.id === assignment.jobId);
    const member = state.users.find((item) => item.id === assignment.memberId);
    const joinedAt = parseCanonicalInstant(assignment.joinedAt);
    const endedAt = assignment.endedAt === undefined ? undefined : parseCanonicalInstant(assignment.endedAt);
    if (
      !assignment.id ||
      assignmentIds.has(assignment.id) ||
      !job ||
      !member ||
      joinedAt === null ||
      endedAt === null ||
      (endedAt !== undefined && joinedAt !== null && endedAt < joinedAt) ||
      (job.archivedAt && !assignment.endedAt)
    )
      throw new Error('Invalid job assignment: ' + assignment.id);
    assignmentIds.add(assignment.id);
    if (!assignment.endedAt) {
      const key = JSON.stringify([assignment.jobId, assignment.memberId]);
      if (memberships.has(key)) throw new Error('Duplicate active job assignment');
      memberships.add(key);
    }
  }
};
