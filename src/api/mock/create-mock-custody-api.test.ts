import { describe, expect, it } from 'vitest';
import { createMockApi } from './create-mock-api';
import { createMockDatabase } from './mock-database';

describe('createMockApi custody projections', () => {
  it('scopes pending handoffs to the requested worker identity', async () => {
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
      handoffs: [
        ...state.handoffs,
        {
          id: 'HO-2',
          kind: 'warehouse-request',
          toolUnitId: 'TL-109',
          from: { type: 'warehouse', warehouseId: 'north-yard' },
          to: { type: 'worker', userId: 'jordan-lee' },
          requestedBy: 'jordan-lee',
          requestedAt: '2026-08-17T11:00:00-06:00',
          status: 'pending',
        },
        {
          id: 'HO-3',
          kind: 'transfer',
          toolUnitId: 'TL-101',
          from: { type: 'worker', userId: 'ray-torres' },
          to: { type: 'warehouse', warehouseId: 'north-yard' },
          requestedBy: 'ray-torres',
          requestedAt: '2026-08-17T12:00:00-06:00',
          status: 'pending',
        },
        {
          id: 'HO-4',
          kind: 'transfer',
          toolUnitId: 'TL-102',
          from: { type: 'worker', userId: 'ray-torres' },
          to: { type: 'worker', userId: 'jordan-lee' },
          requestedBy: 'ray-torres',
          requestedAt: '2026-08-17T12:30:00-06:00',
          status: 'pending',
        },
        {
          id: 'HO-5',
          kind: 'warehouse-request',
          toolUnitId: 'TL-105',
          from: { type: 'warehouse', warehouseId: 'north-yard' },
          to: { type: 'worker', userId: 'jordan-lee' },
          requestedBy: 'jordan-lee',
          requestedAt: '2026-08-17T13:00:00-06:00',
          status: 'pending',
        },
      ],
    }));
    const api = createMockApi(database);
    expect((await api.custody.listPendingHandoffs('ray-torres')).map((handoff) => handoff.id)).toEqual([
      'HO-1',
      'HO-3',
      'HO-4',
    ]);
    expect((await api.custody.listPendingHandoffs('jordan-lee')).map((handoff) => handoff.id)).toEqual([
      'HO-2',
      'HO-4',
      'HO-5',
    ]);
    expect(await api.custody.listPendingHandoffs('sam-ochoa')).toEqual([]);
    expect(await api.custody.listPendingHandoffs('unrelated-worker')).toEqual([]);
  });

  it('creates a warehouse request without moving custody and rejects a second pending command', async () => {
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
    const before = database.read();
    const mutation = await api.custody.requestTool({
      toolUnitId: 'TL-105',
      actorId: 'ray-torres',
      evidence: { note: 'Need it for tomorrow', mockPhoto: true },
    });
    const after = database.read();
    expect(mutation.status).toBe('pending');
    expect(after.custody.find((record) => record.toolUnitId === 'TL-105')).toEqual(
      before.custody.find((record) => record.toolUnitId === 'TL-105'),
    );
    expect(after.handoffs.find((handoff) => handoff.id === mutation.handoffId)).toMatchObject({
      kind: 'warehouse-request',
      status: 'pending',
      evidence: { note: 'Need it for tomorrow', mockPhoto: true },
    });
    expect(after.events.find((event) => event.id === mutation.eventId)).toMatchObject({
      action: 'Requested Rotary hammer from North Yard',
      evidence: { note: 'Need it for tomorrow', mockPhoto: true },
    });
    await expect(api.activity.listActivity()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: mutation.eventId,
          evidence: { note: 'Need it for tomorrow', mockPhoto: true },
        }),
      ]),
    );
    await expect(api.custody.requestTool({ toolUnitId: 'TL-105', actorId: 'ray-torres' })).rejects.toThrow(
      'already pending',
    );
    await expect(api.custody.requestTool({ toolUnitId: 'TL-105', actorId: 'jordan-lee' })).rejects.toThrow(
      'already pending',
    );
    expect(database.read().handoffs.filter((handoff) => handoff.toolUnitId === 'TL-105')).toHaveLength(1);
  });

  it('rejects damaged and lost warehouse stock without changing state', async () => {
    for (const [toolUnitId, holder] of [
      ['TL-104', { type: 'warehouse', warehouseId: 'north-yard' }],
      ['TL-111', { type: 'warehouse', warehouseId: 'riverside-depot' }],
    ] as const) {
      const database = createMockDatabase();
      if (toolUnitId === 'TL-104') {
        database.update((state) => ({
          ...state,
          units: state.units.map((unit) =>
            unit.id === toolUnitId ? { ...unit, assignedWarehouseId: holder.warehouseId } : unit,
          ),
          custody: state.custody.map((record) => (record.toolUnitId === toolUnitId ? { ...record, holder } : record)),
        }));
      }
      const api = createMockApi(database);
      const before = database.read();
      await expect(api.custody.requestTool({ toolUnitId, actorId: 'ray-torres' })).rejects.toThrow(
        'Only serviceable warehouse stock',
      );
      expect(database.read()).toEqual(before);
    }
  });

  it('rejects condition reports from non-holders and unsafe damaged/lost transfers atomically', async () => {
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
    const before = database.read();
    await expect(
      api.custody.reportToolCondition({ toolUnitId: 'TL-101', actorId: 'jordan-lee', condition: 'damaged' }),
    ).rejects.toThrow('current worker holder');
    expect(database.read()).toEqual(before);

    await expect(
      api.custody.startTransfer({
        toolUnitId: 'TL-104',
        actorId: 'ray-torres',
        to: { type: 'worker', userId: 'jordan-lee' },
      }),
    ).rejects.toThrow('destination');
    expect(database.read().custody.find((record) => record.toolUnitId === 'TL-104')).toMatchObject({
      holder: { type: 'worker', userId: 'ray-torres' },
    });

    database.update((state) => ({
      ...state,
      custody: state.custody.map((record) =>
        record.toolUnitId === 'TL-111' ? { ...record, holder: { type: 'worker', userId: 'ray-torres' } } : record,
      ),
    }));
    await expect(
      api.custody.startTransfer({
        toolUnitId: 'TL-111',
        actorId: 'ray-torres',
        to: { type: 'warehouse', warehouseId: 'north-yard' },
      }),
    ).rejects.toThrow('destination');
  });

  it('keeps warehouse-target transfers pending until a later warehouse workflow', async () => {
    const database = createMockDatabase();
    const api = createMockApi(database);
    const started = await api.custody.startTransfer({
      toolUnitId: 'TL-101',
      actorId: 'ray-torres',
      to: { type: 'warehouse', warehouseId: 'south-shop' },
    });
    expect(database.read().handoffs.find((handoff) => handoff.id === started.handoffId)).toMatchObject({
      kind: 'transfer',
      status: 'pending',
      to: { type: 'warehouse', warehouseId: 'south-shop' },
    });
    expect((await api.tools.getToolDetail('TL-101')).tool.holder).toMatchObject({ userId: 'ray-torres' });
    await expect(
      api.custody.acceptTransfer({ handoffId: started.handoffId!, toolUnitId: 'TL-101', actorId: 'sam-ochoa' }),
    ).rejects.toThrow('Only workers can resolve handoffs');
    await expect(
      api.custody.declineTransfer({ handoffId: started.handoffId!, toolUnitId: 'TL-101', actorId: 'sam-ochoa' }),
    ).rejects.toThrow('Only workers can resolve handoffs');
    expect((await api.custody.listPendingHandoffs('ray-torres')).some(({ id }) => id === started.handoffId)).toBe(true);
    await api.custody.cancelTransfer({ handoffId: started.handoffId!, toolUnitId: 'TL-101', actorId: 'ray-torres' });
    expect(database.read().handoffs.find((handoff) => handoff.id === started.handoffId)?.status).toBe('cancelled');
    expect((await api.custody.listPendingHandoffs('ray-torres')).some(({ id }) => id === started.handoffId)).toBe(
      false,
    );
  });

  it('rejects admin actors at worker-only custody command boundaries', async () => {
    const database = createMockDatabase();
    const api = createMockApi(database);
    const before = database.read();
    await expect(api.custody.requestTool({ toolUnitId: 'TL-105', actorId: 'sam-ochoa' })).rejects.toThrow(
      'Only workers can request tools',
    );
    await expect(
      api.custody.startTransfer({
        toolUnitId: 'TL-101',
        actorId: 'sam-ochoa',
        to: { type: 'warehouse', warehouseId: 'south-shop' },
      }),
    ).rejects.toThrow('Only workers can start transfers');
    await expect(api.custody.listTransferTargets({ actorId: 'sam-ochoa', toolUnitId: 'TL-101' })).rejects.toThrow(
      'Only workers can select transfer targets',
    );
    await expect(
      api.custody.reportToolCondition({ toolUnitId: 'TL-101', actorId: 'sam-ochoa', condition: 'damaged' }),
    ).rejects.toThrow('Only a worker can report a condition');
    expect(database.read()).toEqual(before);
  });

  it('rejects non-holder workers and serviceable worker-held requests without changing custody', async () => {
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
    const before = database.read();
    await expect(
      api.custody.startTransfer({
        toolUnitId: 'TL-101',
        actorId: 'jordan-lee',
        to: { type: 'warehouse', warehouseId: 'south-shop' },
      }),
    ).rejects.toThrow('destination');
    expect(database.read()).toEqual(before);
    await expect(api.custody.requestTool({ toolUnitId: 'TL-101', actorId: 'ray-torres' })).rejects.toThrow(
      'serviceable warehouse stock',
    );
    expect(database.read()).toEqual(before);
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
    expect(database.read().handoffs.find((handoff) => handoff.id === started.handoffId)?.status).toBe('cancelled');
    await expect(
      api.custody.acceptTransfer({ handoffId: started.handoffId!, toolUnitId: 'TL-101', actorId: 'jordan-lee' }),
    ).rejects.toThrow('cannot be accepted');
    expect((await api.tools.getToolDetail('TL-101')).tool.holder).toMatchObject({
      type: 'worker',
      userId: 'ray-torres',
    });
  });
});
