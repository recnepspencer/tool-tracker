import type { JobVersionInput } from '../contracts/jobs-api';
import { normalizeJobName } from '../../domain/jobs';
import { WorkflowError } from '../../domain/workflow-error';
import { requireAdminActor } from './admin-authorization';
import { requireJobActor } from './job-authorization';
import { appendAuditEvent } from './audit-events';
import type { MockDatabase } from './mock-database';
import type { MockDatabaseState } from './seed-state';

const uniqueName = (state: MockDatabaseState, value: string, exceptId?: string) => {
  const name = normalizeJobName(value);
  if (!name) throw new WorkflowError('invalid', 'Job name is required');
  if (state.jobs.some((job) => job.id !== exceptId && job.name.toLowerCase() === name.toLowerCase()))
    throw new WorkflowError('conflict', 'A job with this name already exists. Check archived jobs too.');
  return name;
};

const versionedJob = (state: MockDatabaseState, input: JobVersionInput) => {
  const job = state.jobs.find((item) => item.id === input.jobId);
  if (!job) throw new WorkflowError('not-found', 'Job not found');
  if (job.revision !== input.expectedRevision)
    throw new WorkflowError('conflict', 'This job changed. Refresh and try again.');
  return job;
};

const audit = (state: MockDatabaseState, database: MockDatabase, actorId: string, action: string) => {
  const actor = state.users.find((user) => user.id === actorId)!;
  appendAuditEvent(state, database, {
    actorId,
    action,
    kind: 'admin',
    scope: 'admin',
    participantIds: [actorId],
    warehouseId: actor.homeWarehouseId,
    occurredAt: database.clock(),
  });
};

export const createJob = (database: MockDatabase, input: { actorId: string; name: string }) => {
  database.update((state) => {
    requireAdminActor(state, input.actorId);
    const name = uniqueName(state, input.name);
    state.jobs.push({ id: database.nextId('JOB'), name, revision: 1 });
    audit(state, database, input.actorId, 'Created job ' + name);
    return state;
  });
};

export const changeJob = (
  database: MockDatabase,
  input: JobVersionInput & { name?: string },
  action: 'rename' | 'archive' | 'restore',
) => {
  database.update((state) => {
    requireAdminActor(state, input.actorId);
    const job = versionedJob(state, input);
    if (action === 'rename') job.name = uniqueName(state, input.name ?? '', job.id);
    if (action === 'archive') {
      if (job.archivedAt) throw new WorkflowError('conflict', 'Job is already archived');
      job.archivedAt = database.clock();
      state.jobAssignments.forEach((assignment) => {
        if (assignment.jobId === job.id && !assignment.endedAt) assignment.endedAt = job.archivedAt;
      });
    }
    if (action === 'restore') {
      if (!job.archivedAt) throw new WorkflowError('conflict', 'Job is already active');
      delete job.archivedAt;
    }
    job.revision += 1;
    audit(
      state,
      database,
      input.actorId,
      `${action === 'rename' ? 'Renamed' : action === 'archive' ? 'Archived' : 'Restored'} job ${job.name}`,
    );
    return state;
  });
};

export const setJobMembership = (database: MockDatabase, input: JobVersionInput & { joined: boolean }) => {
  database.update((state) => {
    requireJobActor(state, input.actorId, true);
    const job = versionedJob(state, input);
    if (job.archivedAt) throw new WorkflowError('conflict', 'This job is archived');
    const assignment = state.jobAssignments.find(
      (item) => item.jobId === job.id && item.memberId === input.actorId && !item.endedAt,
    );
    if (Boolean(assignment) === input.joined) return state;
    if (input.joined)
      state.jobAssignments.push({
        id: database.nextId('JA'),
        jobId: job.id,
        memberId: input.actorId,
        joinedAt: database.clock(),
      });
    else if (assignment) assignment.endedAt = database.clock();
    audit(state, database, input.actorId, `${input.joined ? 'Joined' : 'Left'} job ${job.name}`);
    return state;
  });
};
