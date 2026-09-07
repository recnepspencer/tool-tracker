import type { JobsApi, JobVersionInput } from '../contracts/jobs-api';
import type { HttpApiOptions } from './http-options';
import { pathWithBase } from './http-transport';
import { mapJobs, mapForemen, type JobViewDto, type ForemanDto } from './http-job-mappers';

export const createHttpJobsApi = ({ transport, basePath = '/api' }: HttpApiOptions): JobsApi => {
  const path = (suffix: string) => pathWithBase(basePath, suffix);
  const change = async (action: string, input: JobVersionInput, extra: Record<string, unknown> = {}) => {
    await transport.post(path('/jobs/' + encodeURIComponent(input.jobId) + '/' + action), {
      actor_id: input.actorId,
      expected_revision: input.expectedRevision,
      ...extra,
    });
  };
  return {
    list: async ({ actorId }) =>
      mapJobs(await transport.get<JobViewDto[]>(path('/jobs?actor_id=' + encodeURIComponent(actorId)))),
    listForemen: async ({ actorId }) =>
      mapForemen(await transport.get<ForemanDto[]>(path('/foremen?actor_id=' + encodeURIComponent(actorId)))),
    create: async ({ actorId, name }) => {
      await transport.post(path('/jobs'), { actor_id: actorId, name });
    },
    rename: (input) => change('rename', input, { name: input.name }),
    archive: (input) => change('archive', input),
    restore: (input) => change('restore', input),
    setMembership: (input) => change('membership', input, { joined: input.joined }),
  };
};
