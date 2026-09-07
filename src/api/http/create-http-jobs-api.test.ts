import { describe, expect, it } from 'vitest';
import { createHttpJobsApi } from './create-http-jobs-api';
import type { HttpTransport } from './http-options';

describe('HTTP jobs boundary', () => {
  it('sends versioned membership and archive commands and maps job metadata', async () => {
    const calls: Array<{ path: string; body: unknown }> = [];
    const api = createHttpJobsApi({
      basePath: '/service/',
      transport: {
        get: (async () => [
          { job_id: 'job/1', name: 'School', revision: 2, member_count: 3, joined: true },
        ]) as HttpTransport['get'],
        post: (async (path, body) => {
          calls.push({ path, body });
        }) as HttpTransport['post'],
      },
    });
    expect(await api.list({ actorId: 'ray' })).toEqual([
      { id: 'job/1', name: 'School', revision: 2, memberCount: 3, joined: true },
    ]);
    await api.setMembership({ actorId: 'ray', jobId: 'job/1', expectedRevision: 2, joined: false });
    await api.archive({ actorId: 'sam', jobId: 'job/1', expectedRevision: 2 });
    expect(calls).toEqual([
      { path: '/service/jobs/job%2F1/membership', body: { actor_id: 'ray', expected_revision: 2, joined: false } },
      { path: '/service/jobs/job%2F1/archive', body: { actor_id: 'sam', expected_revision: 2 } },
    ]);
  });

  it('rejects malformed memberships and archived jobs presented as current directory assignments', async () => {
    let response: unknown = [{ job_id: 'job-1', name: 'School', revision: 1, member_count: 0, joined: 'yes' }];
    const api = createHttpJobsApi({
      transport: {
        get: (async () => response) as HttpTransport['get'],
        post: (async () => undefined) as HttpTransport['post'],
      },
    });
    await expect(api.list({ actorId: 'ray' })).rejects.toThrow('membership');
    response = [
      {
        member_id: 'ray',
        name: 'Ray',
        jobs: [{ job_id: 'job-1', name: 'School', revision: 2, archived_at: '2026-09-01T00:00:00Z' }],
        tools: [],
      },
    ];
    await expect(api.listForemen({ actorId: 'ray' })).rejects.toThrow('custody or jobs');
    response = [{ member_id: 'ray', name: 'Ray', jobs: [], tools: [] }];
    await expect(api.listForemen({ actorId: 'ray' })).resolves.toEqual([
      { id: 'ray', name: 'Ray', jobs: [], tools: [] },
    ]);
  });
});
