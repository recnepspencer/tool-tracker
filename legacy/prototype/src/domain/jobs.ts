export interface Job {
  id: string;
  name: string;
  revision: number;
  archivedAt?: string;
}

/** Job participation is independent of tool custody. Ended assignments retain history. */
export interface JobAssignment {
  id: string;
  jobId: string;
  memberId: string;
  joinedAt: string;
  endedAt?: string;
}

export const normalizeJobName = (name: string) => name.trim().replace(/\s+/g, ' ');
