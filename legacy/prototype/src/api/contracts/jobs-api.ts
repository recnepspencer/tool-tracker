import type { Job } from '../../domain/jobs';
import type { ToolView } from '../../domain/read-models/tools';

export interface JobView extends Job {
  memberCount: number;
  joined: boolean;
}

export interface ForemanView {
  id: string;
  name: string;
  jobs: Job[];
  tools: Array<ToolView & { transferTo?: string }>;
}

export interface JobActorInput {
  actorId: string;
}
export interface JobVersionInput extends JobActorInput {
  jobId: string;
  expectedRevision: number;
}

export interface JobsApi {
  list(input: JobActorInput): Promise<JobView[]>;
  create(input: JobActorInput & { name: string }): Promise<void>;
  rename(input: JobVersionInput & { name: string }): Promise<void>;
  archive(input: JobVersionInput): Promise<void>;
  restore(input: JobVersionInput): Promise<void>;
  setMembership(input: JobVersionInput & { joined: boolean }): Promise<void>;
  listForemen(input: JobActorInput): Promise<ForemanView[]>;
}
