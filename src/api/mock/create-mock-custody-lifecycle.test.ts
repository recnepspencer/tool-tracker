import { describe, expect, it } from 'vitest';
import { createMockApi } from './create-mock-api';
import { createMockDatabase } from './mock-database';

describe('createMockApi custody lifecycle', () => {
  it('moves custody only when an incoming peer transfer is accepted', async () => {
    const database = createMockDatabase({ clock: () => '2026-08-18T09:00:00-06:00' });
    database.update((state) => ({
      ...state,
      users: [
        ...state.users,
        {
          id: 'jordan-lee',
          name: 'Jordan Lee',
          email: 'jordan@nelsonelectric.com',
          role: 'worker',
          lifecycle: 'active',
          title: 'Apprentice electrician',
          homeWarehouseId: 'north-yard',
        },
      ],
    }));
    const api = createMockApi(database);
    const started = await api.custody.startTransfer({
      toolUnitId: 'TL-101',
      actorId: 'ray-torres',
      to: { type: 'worker', userId: 'jordan-lee' },
    });
    expect((await api.tools.getToolDetail('TL-101')).tool.holder).toMatchObject({
      type: 'worker',
      userId: 'ray-torres',
    });
    await expect(
      api.custody.acceptTransfer({ handoffId: started.handoffId!, toolUnitId: 'TL-101', actorId: 'sam-ochoa' }),
    ).rejects.toThrow('Only workers can resolve handoffs');
    const accepted = await api.custody.acceptTransfer({
      handoffId: started.handoffId!,
      toolUnitId: 'TL-101',
      actorId: 'jordan-lee',
      evidence: { photo: { fileName: 'proof.jpg', src: 'data:image/jpeg;base64,cHJvb2Y=' } },
    });
    expect((await api.tools.getToolDetail('TL-101')).tool.holder).toMatchObject({
      type: 'worker',
      userId: 'jordan-lee',
    });
    expect(database.read().events.at(-1)).toMatchObject({
      action: 'Accepted Hammer drill handoff',
      evidence: { photo: { fileName: 'proof.jpg', src: 'data:image/jpeg;base64,cHJvb2Y=' } },
    });
    expect(database.read().handoffs.find((handoff) => handoff.id === started.handoffId)).toMatchObject({
      resolutionEvidence: { photo: { fileName: 'proof.jpg', src: 'data:image/jpeg;base64,cHJvb2Y=' } },
    });
    await expect(api.activity.listActivity()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: accepted.eventId,
          evidence: { photo: { fileName: 'proof.jpg', src: 'data:image/jpeg;base64,cHJvb2Y=' } },
        }),
      ]),
    );
    await expect(
      api.custody.acceptTransfer({ handoffId: started.handoffId!, toolUnitId: 'TL-101', actorId: 'jordan-lee' }),
    ).rejects.toThrow('cannot be accepted');
  });

  it('retains historical handoffs while allowing sequential accepted transfers', async () => {
    const database = createMockDatabase({ clock: () => '2026-08-18T09:00:00-06:00' });
    database.update((state) => ({
      ...state,
      users: [
        ...state.users,
        {
          id: 'jordan-lee',
          name: 'Jordan Lee',
          email: 'jordan@nelsonelectric.com',
          role: 'worker',
          lifecycle: 'active',
          title: 'Apprentice electrician',
          homeWarehouseId: 'north-yard',
        },
        {
          id: 'casey-nguyen',
          name: 'Casey Nguyen',
          email: 'casey@nelsonelectric.com',
          role: 'worker',
          lifecycle: 'active',
          title: 'Field electrician',
          homeWarehouseId: 'south-shop',
        },
      ],
    }));
    const api = createMockApi(database);
    const first = await api.custody.startTransfer({
      toolUnitId: 'TL-101',
      actorId: 'ray-torres',
      to: { type: 'worker', userId: 'jordan-lee' },
    });
    await api.custody.acceptTransfer({ handoffId: first.handoffId!, toolUnitId: 'TL-101', actorId: 'jordan-lee' });
    const second = await api.custody.startTransfer({
      toolUnitId: 'TL-101',
      actorId: 'jordan-lee',
      to: { type: 'worker', userId: 'casey-nguyen' },
    });
    await api.custody.acceptTransfer({ handoffId: second.handoffId!, toolUnitId: 'TL-101', actorId: 'casey-nguyen' });
    expect((await api.tools.getToolDetail('TL-101')).tool.holder).toMatchObject({
      type: 'worker',
      userId: 'casey-nguyen',
    });
    expect(database.read().handoffs.find((handoff) => handoff.id === first.handoffId)?.status).toBe('accepted');
    expect(database.read().handoffs.find((handoff) => handoff.id === second.handoffId)?.status).toBe('accepted');
  });

  it.each([
    { decision: 'declineTransfer' as const, toolUnitId: 'TL-101', actorId: 'jordan-lee', kind: 'transfer' as const },
    { decision: 'cancelTransfer' as const, toolUnitId: 'TL-101', actorId: 'ray-torres', kind: 'transfer' as const },
    {
      decision: 'withdrawRequest' as const,
      toolUnitId: 'TL-105',
      actorId: 'ray-torres',
      kind: 'warehouse-request' as const,
    },
  ])('retains terminal %s outcomes without moving custody', async ({ decision, toolUnitId, actorId, kind }) => {
    const database = createMockDatabase({ clock: () => '2026-08-18T09:00:00-06:00' });
    database.update((state) => ({
      ...state,
      users: [
        ...state.users,
        {
          id: 'jordan-lee',
          name: 'Jordan Lee',
          email: 'jordan@nelsonelectric.com',
          role: 'worker',
          lifecycle: 'active',
          title: 'Apprentice electrician',
          homeWarehouseId: 'north-yard',
        },
      ],
    }));
    const api = createMockApi(database);
    const started =
      kind === 'transfer'
        ? await api.custody.startTransfer({
            toolUnitId,
            actorId: 'ray-torres',
            to: { type: 'worker', userId: 'jordan-lee' },
          })
        : await api.custody.requestTool({ toolUnitId, actorId: 'ray-torres' });
    const before = database.read().custody.find((record) => record.toolUnitId === toolUnitId);
    const resolved = await api.custody[decision]({
      handoffId: started.handoffId!,
      toolUnitId,
      actorId,
      evidence: { note: 'Terminal decision evidence' },
    });
    expect(database.read().custody.find((record) => record.toolUnitId === toolUnitId)).toEqual(before);
    expect(database.read().handoffs.find((handoff) => handoff.id === started.handoffId)).toMatchObject({
      status: decision === 'declineTransfer' ? 'declined' : decision === 'cancelTransfer' ? 'cancelled' : 'withdrawn',
      resolutionEvidence: { note: 'Terminal decision evidence' },
      resolvedBy: actorId,
    });
    expect(database.read().events.find((event) => event.id === resolved.eventId)).toMatchObject({
      evidence: { note: 'Terminal decision evidence' },
    });
    await expect(api.activity.listActivity()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: resolved.eventId, evidence: { note: 'Terminal decision evidence' } }),
      ]),
    );
    await expect(api.custody[decision]({ handoffId: started.handoffId!, toolUnitId, actorId })).rejects.toThrow(
      'cannot be',
    );
  });

  it('rejects terminal decisions from actors outside the handoff policy', async () => {
    const database = createMockDatabase();
    database.update((state) => ({
      ...state,
      users: [
        ...state.users,
        {
          id: 'jordan-lee',
          name: 'Jordan Lee',
          email: 'jordan@nelsonelectric.com',
          role: 'worker',
          lifecycle: 'active',
          title: 'Apprentice electrician',
          homeWarehouseId: 'north-yard',
        },
      ],
    }));
    const api = createMockApi(database);
    const transfer = await api.custody.startTransfer({
      toolUnitId: 'TL-101',
      actorId: 'ray-torres',
      to: { type: 'worker', userId: 'jordan-lee' },
    });
    const transferInput = { handoffId: transfer.handoffId!, toolUnitId: 'TL-101' };
    const transferBefore = database.read();
    await expect(api.custody.acceptTransfer({ ...transferInput, actorId: 'ray-torres' })).rejects.toThrow(
      'cannot be accepted',
    );
    await expect(api.custody.declineTransfer({ ...transferInput, actorId: 'ray-torres' })).rejects.toThrow(
      'cannot be declined',
    );
    await expect(api.custody.cancelTransfer({ ...transferInput, actorId: 'jordan-lee' })).rejects.toThrow(
      'cannot be cancelled',
    );
    expect(database.read()).toEqual(transferBefore);

    const request = await api.custody.requestTool({ toolUnitId: 'TL-105', actorId: 'ray-torres' });
    const requestInput = { handoffId: request.handoffId!, toolUnitId: 'TL-105' };
    const requestBefore = database.read();
    await expect(api.custody.withdrawRequest({ ...requestInput, actorId: 'jordan-lee' })).rejects.toThrow(
      'cannot be withdrawn',
    );
    await expect(api.custody.withdrawRequest({ ...requestInput, actorId: 'sam-ochoa' })).rejects.toThrow(
      'Only workers can resolve handoffs',
    );
    expect(database.read()).toEqual(requestBefore);
  });

  it('rejects admin recipients and leaves custody unchanged', async () => {
    const database = createMockDatabase();
    const api = createMockApi(database);
    const before = database.read().custody.find((record) => record.toolUnitId === 'TL-101');
    await expect(
      api.custody.startTransfer({
        toolUnitId: 'TL-101',
        actorId: 'ray-torres',
        to: { type: 'worker', userId: 'sam-ochoa' },
      }),
    ).rejects.toThrow('destination');
    expect(database.read().custody.find((record) => record.toolUnitId === 'TL-101')).toEqual(before);
  });

  it('reports a condition atomically and blocks stale handoff acceptance', async () => {
    const database = createMockDatabase({ clock: () => '2026-08-18T09:00:00-06:00' });
    database.update((state) => ({
      ...state,
      users: [
        ...state.users,
        {
          id: 'jordan-lee',
          name: 'Jordan Lee',
          email: 'jordan@nelsonelectric.com',
          role: 'worker',
          lifecycle: 'active',
          title: 'Apprentice electrician',
          homeWarehouseId: 'north-yard',
        },
      ],
    }));
    const api = createMockApi(database);
    const started = await api.custody.startTransfer({
      toolUnitId: 'TL-101',
      actorId: 'ray-torres',
      to: { type: 'worker', userId: 'jordan-lee' },
    });
    await api.custody.reportToolCondition({
      toolUnitId: 'TL-101',
      actorId: 'ray-torres',
      condition: 'lost',
      evidence: { note: 'Not in the truck' },
    });
    expect((await api.tools.getToolDetail('TL-101')).condition).toBe('lost');
    expect(database.read().handoffs.find((handoff) => handoff.id === started.handoffId)).toMatchObject({
      status: 'cancelled',
      resolutionEvidence: { note: 'Not in the truck' },
    });
    await expect(
      api.custody.acceptTransfer({ handoffId: started.handoffId!, toolUnitId: 'TL-101', actorId: 'jordan-lee' }),
    ).rejects.toThrow('cannot be accepted');
    expect((await api.tools.getToolDetail('TL-101')).tool.holder).toMatchObject({
      type: 'worker',
      userId: 'ray-torres',
    });
  });
});
