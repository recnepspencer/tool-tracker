import type { JobsApi } from '../contracts/jobs-api';
import { requireJobActor } from './job-authorization';
import { createJob, changeJob, setJobMembership } from './job-mutations';
import { toToolView } from './mock-tool-projections';
import type { MockDatabase } from './mock-database';

export const createMockJobsApi = (database: MockDatabase): JobsApi => ({
  list: async ({ actorId }) => {
    const state = database.read();
    const actor = requireJobActor(state, actorId);
    return state.jobs
      .filter((job) => actor.role === 'admin' || !job.archivedAt)
      .map((job) => ({
        ...job,
        memberCount: state.jobAssignments.filter(
          (assignment) =>
            assignment.jobId === job.id &&
            !assignment.endedAt &&
            state.users.some(
              (user) => user.id === assignment.memberId && user.lifecycle === 'active' && user.role === 'worker',
            ),
        ).length,
        joined: state.jobAssignments.some(
          (assignment) => assignment.jobId === job.id && assignment.memberId === actorId && !assignment.endedAt,
        ),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
  create: async (input) => createJob(database, input),
  rename: async (input) => changeJob(database, input, 'rename'),
  archive: async (input) => changeJob(database, input, 'archive'),
  restore: async (input) => changeJob(database, input, 'restore'),
  setMembership: async (input) => setJobMembership(database, input),
  listForemen: async ({ actorId }) => {
    const state = database.read();
    requireJobActor(state, actorId);
    return state.users
      .filter((member) => member.role === 'worker' && member.lifecycle === 'active')
      .map((member) => ({
        id: member.id,
        name: member.name,
        jobs: state.jobs
          .filter(
            (job) =>
              !job.archivedAt &&
              state.jobAssignments.some(
                (assignment) => assignment.memberId === member.id && assignment.jobId === job.id && !assignment.endedAt,
              ),
          )
          .map((job) => ({ ...job })),
        tools: state.units
          .filter(
            (unit) =>
              unit.lifecycle === 'active' &&
              state.custody.some(
                (record) =>
                  record.toolUnitId === unit.id &&
                  record.holder.type === 'worker' &&
                  record.holder.userId === member.id,
              ),
          )
          .map((unit) => {
            const handoff = state.handoffs.find(
              (item) => item.toolUnitId === unit.id && item.kind === 'transfer' && item.status === 'pending',
            );
            const target = handoff?.to;
            const transferTo =
              target?.type === 'worker'
                ? state.users.find((user) => user.id === target.userId)?.name
                : target?.type === 'warehouse'
                  ? state.warehouses.find((warehouse) => warehouse.id === target.warehouseId)?.name
                  : undefined;
            return { ...toToolView(state, unit.id), ...(transferTo ? { transferTo } : {}) };
          }),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});
