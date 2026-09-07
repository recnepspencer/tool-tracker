import type { ForemanView, JobView } from '../contracts/jobs-api';
import type { Job } from '../../domain/jobs';
import type { ToolDto } from './http-tool-types';
import { mapTool } from './http-tool-mappers';
import { assertUniqueIds } from './http-transport';
import {
  arrayValue,
  instantValue,
  nonBlankStringValue,
  nonNegativeIntegerValue,
  positiveIntegerValue,
} from './http-validation';

export interface JobDto {
  job_id: string;
  name: string;
  revision: number;
  archived_at?: string;
}
export interface JobViewDto extends JobDto {
  member_count: number;
  joined: boolean;
}
export interface ForemanDto {
  member_id: string;
  name: string;
  jobs: JobDto[];
  tools: Array<ToolDto & { transfer_to?: string }>;
}

const mapJob = (dto: JobDto): Job => ({
  id: nonBlankStringValue(dto.job_id, 'job id'),
  name: nonBlankStringValue(dto.name, 'job name'),
  revision: positiveIntegerValue(dto.revision, 'job revision'),
  ...(dto.archived_at === undefined ? {} : { archivedAt: instantValue(dto.archived_at, 'job archive time') }),
});

export const mapJobs = (dtos: JobViewDto[]): JobView[] => {
  const jobs = arrayValue<JobViewDto>(dtos, 'jobs').map((dto) => {
    if (typeof dto.joined !== 'boolean') throw new Error('Invalid API response: job membership');
    return {
      ...mapJob(dto),
      memberCount: nonNegativeIntegerValue(dto.member_count, 'job member count'),
      joined: dto.joined,
    };
  });
  assertUniqueIds(jobs, 'jobs');
  return jobs;
};

export const mapForemen = (dtos: ForemanDto[]): ForemanView[] => {
  const foremen = arrayValue<ForemanDto>(dtos, 'foremen').map((dto) => {
    const jobs = arrayValue<JobDto>(dto.jobs, 'foreman jobs').map(mapJob);
    const tools = arrayValue<ToolDto & { transfer_to?: string }>(dto.tools, 'foreman tools').map((tool) => ({
      ...mapTool(tool),
      ...(tool.transfer_to === undefined
        ? {}
        : { transferTo: nonBlankStringValue(tool.transfer_to, 'transfer destination') }),
    }));
    assertUniqueIds(jobs, 'foreman jobs');
    assertUniqueIds(tools, 'foreman tools');
    if (
      jobs.some((job) => job.archivedAt) ||
      tools.some((tool) => tool.holder.type !== 'worker' || tool.holder.userId !== dto.member_id)
    )
      throw new Error('Invalid API response: foreman custody or jobs');
    return {
      id: nonBlankStringValue(dto.member_id, 'foreman id'),
      name: nonBlankStringValue(dto.name, 'foreman name'),
      jobs,
      tools,
    };
  });
  assertUniqueIds(foremen, 'foremen');
  assertUniqueIds(
    foremen.flatMap((foreman) => foreman.tools),
    'directory custody',
  );
  return foremen;
};
