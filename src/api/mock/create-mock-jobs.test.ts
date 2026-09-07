import { describe, expect, it } from 'vitest';
import { createMockApi } from './create-mock-api';
import { createMockDatabase } from './mock-database';

const admin = { actorId: 'sam-ochoa' };
const worker = { actorId: 'ray-torres' };

describe('jobs and foreman custody', () => {
  it('supports multiple independent jobs, leaves, archives, and restores without resurrecting assignments', async () => {
    const db = createMockDatabase();
    const api = createMockApi(db);
    const before = db.read();
    await api.jobs.create({ ...admin, name: '  Central   School ' });
    const job = (await api.jobs.list(admin)).find((item) => item.name === 'Central School')!;
    await api.jobs.setMembership({ ...worker, jobId: job.id, expectedRevision: 1, joined: true });
    await api.jobs.setMembership({ ...worker, jobId: job.id, expectedRevision: 1, joined: true });
    expect((await api.jobs.listForemen(worker)).find((member) => member.id === worker.actorId)?.jobs).toHaveLength(3);
    expect(db.read().jobAssignments.filter((item) => item.jobId === job.id)).toHaveLength(1);
    await api.jobs.rename({ ...admin, jobId: job.id, expectedRevision: 1, name: 'Central School · Phase 2' });
    await api.jobs.archive({ ...admin, jobId: job.id, expectedRevision: 2 });
    expect((await api.jobs.list(worker)).some((item) => item.id === job.id)).toBe(false);
    expect((await api.jobs.list(admin)).find((item) => item.id === job.id)?.archivedAt).toBeTruthy();
    expect(db.read().jobAssignments.find((item) => item.jobId === job.id)?.endedAt).toBeTruthy();
    await api.jobs.restore({ ...admin, jobId: job.id, expectedRevision: 3 });
    expect((await api.jobs.list(worker)).find((item) => item.id === job.id)?.joined).toBe(false);
    await api.jobs.setMembership({ ...worker, jobId: job.id, expectedRevision: 4, joined: true });
    await api.jobs.setMembership({ ...worker, jobId: job.id, expectedRevision: 4, joined: false });
    expect(db.read().jobAssignments.filter((item) => item.jobId === job.id)).toHaveLength(2);
    expect(db.read().custody).toEqual(before.custody);
    expect(db.read().handoffs).toEqual(before.handoffs);
    expect(db.read().units).toEqual(before.units);
  });

  it('rejects unauthorized operations, archived joins, stale edits, and duplicate names atomically', async () => {
    const db = createMockDatabase();
    const api = createMockApi(db);
    const initial = db.read();
    await expect(api.jobs.create({ ...worker, name: 'Forbidden' })).rejects.toThrow('administrator');
    await expect(
      api.jobs.setMembership({ ...admin, jobId: 'job-riverside', expectedRevision: 1, joined: true }),
    ).rejects.toThrow('foreman');
    for (const actorId of ['missing', 'taylor-nguyen', 'casey-reed', 'morgan-price']) {
      await expect(api.jobs.listForemen({ actorId })).rejects.toThrow('active');
      await expect(
        api.jobs.setMembership({ actorId, jobId: 'job-riverside', expectedRevision: 1, joined: true }),
      ).rejects.toThrow('active');
    }
    await expect(api.jobs.create({ ...admin, name: ' ' })).rejects.toThrow('required');
    await expect(api.jobs.create({ ...admin, name: 'south shop · service upgrade' })).rejects.toThrow('already exists');
    await expect(api.jobs.archive({ ...admin, jobId: 'job-riverside', expectedRevision: 99 })).rejects.toThrow(
      'changed',
    );
    await expect(
      api.jobs.setMembership({ ...worker, jobId: 'job-south-service', expectedRevision: 1, joined: true }),
    ).rejects.toThrow('archived');
    expect(db.read()).toEqual(initial);
    await api.jobs.archive({ ...admin, jobId: 'job-riverside', expectedRevision: 1 });
    await expect(
      api.jobs.setMembership({ ...worker, jobId: 'job-riverside', expectedRevision: 1, joined: true }),
    ).rejects.toThrow('changed');
  });

  it('shows all active foremen, including empty ones, and moves a tool only upon acceptance', async () => {
    const db = createMockDatabase();
    const api = createMockApi(db);
    const before = await api.jobs.listForemen(worker);
    expect(before.map((member) => member.id)).toEqual(['avery-cole', 'eli-warren', 'ray-torres']);
    expect(before.find((member) => member.id === 'avery-cole')).toMatchObject({ jobs: [], tools: [] });
    expect(before.find((member) => member.id === 'eli-warren')?.tools).toEqual([
      expect.objectContaining({ id: 'TL-119', transferTo: 'Ray Torres' }),
    ]);
    expect(before.find((member) => member.id === 'ray-torres')?.tools.some((tool) => tool.id === 'TL-119')).toBe(false);
    expect(
      before.find((member) => member.id === 'ray-torres')?.tools.find((tool) => tool.id === 'TL-104')?.status,
    ).toBe('damaged');
    await api.custody.acceptTransfer({ ...worker, handoffId: 'HO-DEMO-IN', toolUnitId: 'TL-119' });
    const after = await api.jobs.listForemen(worker);
    expect(after.find((member) => member.id === 'eli-warren')?.tools).toHaveLength(0);
    expect(
      after.find((member) => member.id === 'ray-torres')?.tools.find((tool) => tool.id === 'TL-119'),
    ).toMatchObject({ holder: { userId: 'ray-torres' } });
    expect(
      after.find((member) => member.id === 'ray-torres')?.tools.find((tool) => tool.id === 'TL-119')?.transferTo,
    ).toBeUndefined();
    expect(after.map((member) => member.jobs)).toEqual(before.map((member) => member.jobs));
  });

  it('validates assignments and isolates returned data from the database', async () => {
    const db = createMockDatabase();
    const api = createMockApi(db);
    const before = db.read();
    expect(() =>
      db.update((state) => {
        state.jobAssignments.push({ ...state.jobAssignments[0], id: 'duplicate' });
        return state;
      }),
    ).toThrow('Duplicate active');
    expect(() =>
      db.update((state) => {
        state.jobAssignments[0].jobId = 'missing';
        return state;
      }),
    ).toThrow('Invalid job assignment');
    const result = await api.jobs.listForemen(worker);
    result[2].jobs[0].name = 'Unexpected mutation';
    result[2].tools[0].name = 'Unexpected mutation';
    expect(db.read()).toEqual(before);
  });
});
