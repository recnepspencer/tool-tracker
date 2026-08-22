import { describe, expect, it } from 'vitest';
import { createMockApi } from './create-mock-api';
import { createMockDatabase } from './mock-database';
import type { MockDatabase } from './mock-database';
import type { MockDatabaseState } from './seed-state';

describe('WarehouseApi mock authority', () => {
  it('projects the seeded request and approves it atomically for Sam', async () => {
    const database = createMockDatabase({ clock: () => '2026-08-19T09:00:00-06:00' });
    const api = createMockApi(database);
    await expect(api.warehouse.listQueue({ actorId: 'sam-ochoa' })).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'HO-1',
          kind: 'request',
          toolUnitId: 'TL-108',
          warehouseId: 'north-yard',
          personName: 'Ray Torres',
        }),
      ]),
    );
    const before = database.read();
    const receipt = await api.warehouse.approveRequest({
      actorId: 'sam-ochoa',
      handoffId: 'HO-1',
      toolUnitId: 'TL-108',
      evidence: { note: 'Approved for the morning crew' },
    });
    const after = database.read();
    expect(receipt).toMatchObject({
      operation: 'approve-request',
      correlationId: 'WH-' + receipt.eventId,
      handoffId: 'HO-1',
      toolUnitId: 'TL-108',
      affectedToolUnitIds: ['TL-108'],
      affectedHandoffIds: ['HO-1'],
    });
    expect(after.handoffs.find((handoff) => handoff.id === 'HO-1')).toMatchObject({
      status: 'accepted',
      resolvedBy: 'sam-ochoa',
    });
    expect(after.custody.find((record) => record.toolUnitId === 'TL-108')).toMatchObject({
      holder: { type: 'worker', userId: 'ray-torres' },
    });
    expect(after.units.find((unit) => unit.id === 'TL-108')?.assignedWarehouseId).toBe('north-yard');
    expect(after.units.find((unit) => unit.id === 'TL-108')?.originWarehouseId).toBe('north-yard');
    expect(after.events).toHaveLength(before.events.length + 1);
    expect(after.events.at(-1)).toMatchObject({
      id: receipt.eventId,
      evidence: { note: 'Approved for the morning crew' },
    });
    expect(after.handoffs.find((handoff) => handoff.id === 'HO-1')?.resolutionEvidence).toEqual({
      note: 'Approved for the morning crew',
    });
    const remainingQueue = await api.warehouse.listQueue({ actorId: 'sam-ochoa' });
    expect(remainingQueue).toHaveLength(2);
    expect(remainingQueue.some((item) => item.id === 'HO-1')).toBe(false);
    expect((await api.tools.listTools()).find((tool) => tool.id === 'TL-108')?.holder).toMatchObject({
      userId: 'ray-torres',
    });
  });

  it('accepts a worker return by moving custody and assignment together', async () => {
    const database = createMockDatabase({ clock: () => '2026-08-19T10:00:00-06:00' });
    const api = createMockApi(database);
    const started = await api.custody.startTransfer({
      actorId: 'ray-torres',
      toolUnitId: 'TL-101',
      to: { type: 'warehouse', warehouseId: 'south-shop' },
      evidence: { note: 'Returning the hammer drill to South Shop' },
    });
    expect(await api.warehouse.listQueue({ actorId: 'sam-ochoa', warehouseId: 'south-shop' })).toMatchObject([
      { id: started.handoffId, kind: 'return', warehouseId: 'south-shop' },
    ]);
    const before = database.read();
    const receipt = await api.warehouse.acceptReturn({
      actorId: 'sam-ochoa',
      handoffId: started.handoffId!,
      toolUnitId: 'TL-101',
      evidence: { note: 'Returned to South Shop' },
    });
    const state = database.read();
    expect(state.custody.find((record) => record.toolUnitId === 'TL-101')).toMatchObject({
      holder: { type: 'warehouse', warehouseId: 'south-shop' },
    });
    expect(state.units.find((unit) => unit.id === 'TL-101')?.assignedWarehouseId).toBe('south-shop');
    expect(state.units.find((unit) => unit.id === 'TL-101')?.originWarehouseId).toBe('north-yard');
    expect(receipt).toMatchObject({
      operation: 'accept-return',
      correlationId: 'WH-' + receipt.eventId,
      handoffId: started.handoffId,
      toolUnitId: 'TL-101',
      affectedToolUnitIds: ['TL-101'],
      affectedHandoffIds: [started.handoffId],
    });
    expect(state.events).toHaveLength(before.events.length + 1);
    expect(state.events.at(-1)).toMatchObject({ id: receipt.eventId, evidence: { note: 'Returned to South Shop' } });
    expect((await api.tools.listCatalog()).find((item) => item.id === 'def-hammer-drill')?.warehouses).toEqual(
      expect.arrayContaining([{ id: 'south-shop', name: 'South Shop', unitCount: 2 }]),
    );
    expect(await api.tools.getToolDetail('TL-101')).toMatchObject({
      tool: {
        id: 'TL-101',
        holder: { type: 'warehouse', warehouseId: 'south-shop', name: 'South Shop' },
      },
      originWarehouse: { id: 'north-yard', name: 'North Yard' },
    });
  });

  it('keeps worker-to-worker handoffs out of the warehouse queue and denies workers', async () => {
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
          title: 'Apprentice',
          homeWarehouseId: 'north-yard',
        },
      ],
      handoffs: [
        ...state.handoffs,
        {
          id: 'HO-2',
          kind: 'transfer',
          toolUnitId: 'TL-102',
          from: { type: 'worker', userId: 'ray-torres' },
          to: { type: 'worker', userId: 'jordan-lee' },
          requestedBy: 'ray-torres',
          requestedAt: '2026-08-19T09:30:00-06:00',
          status: 'pending',
        },
      ],
    }));
    const api = createMockApi(database);
    expect(await api.warehouse.listQueue({ actorId: 'sam-ochoa' })).toHaveLength(3);
    const before = database.read();
    await expect(api.warehouse.listQueue({ actorId: 'ray-torres' })).rejects.toThrow('warehouse operator');
    await expect(
      api.warehouse.approveRequest({ actorId: 'ray-torres', handoffId: 'HO-1', toolUnitId: 'TL-108' }),
    ).rejects.toThrow('warehouse operator');
    expect(database.read()).toEqual(before);
  });

  it('scopes warehouse-manager reads to assigned warehouses and denies inactive operators', async () => {
    const database = createMockDatabase();
    database.update((state) => ({
      ...state,
      warehouses: state.warehouses.map((warehouse) =>
        warehouse.id === 'south-shop' ? { ...warehouse, managerId: 'morgan-price' } : warehouse,
      ),
    }));
    const api = createMockApi(database);
    await expect(api.warehouse.listScopes({ actorId: 'morgan-price' })).resolves.toEqual([
      { id: 'south-shop', name: 'South Shop', address: '88 Trade St' },
    ]);
    await expect(api.warehouse.listQueue({ actorId: 'morgan-price', warehouseId: 'north-yard' })).rejects.toThrow(
      'cannot manage',
    );
    const managerBefore = database.read();
    await expect(
      api.warehouse.approveRequest({ actorId: 'morgan-price', handoffId: 'HO-1', toolUnitId: 'TL-108' }),
    ).rejects.toThrow('cannot manage');
    expect(database.read()).toEqual(managerBefore);
    await expect(api.warehouse.listInventory({ actorId: 'morgan-price' })).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ warehouseId: 'south-shop' })]),
    );
    await expect(api.warehouse.listQueue({ actorId: 'morgan-price' })).resolves.toEqual([]);
    await expect(api.warehouse.listScopes({ actorId: 'ray-torres' })).rejects.toThrow('warehouse operator');
    await expect(api.warehouse.listScopes({ actorId: 'taylor-nguyen' })).rejects.toThrow('warehouse operator');

    const inactiveManagerDatabase = createMockDatabase();
    inactiveManagerDatabase.update((state) => ({
      ...state,
      users: [
        ...state.users,
        {
          id: 'inactive-manager',
          name: 'Inactive Manager',
          email: 'inactive.manager@nelsonelectric.com',
          role: 'warehouse-manager',
          lifecycle: 'suspended',
          title: 'Former warehouse manager',
          homeWarehouseId: 'south-shop',
        },
      ],
    }));
    const inactiveApi = createMockApi(inactiveManagerDatabase);
    await expect(inactiveApi.warehouse.listScopes({ actorId: 'inactive-manager' })).rejects.toThrow(
      'warehouse operator',
    );
    await expect(inactiveApi.warehouse.listQueue({ actorId: 'inactive-manager' })).rejects.toThrow(
      'warehouse operator',
    );
    await expect(inactiveApi.warehouse.listInventory({ actorId: 'inactive-manager' })).rejects.toThrow(
      'warehouse operator',
    );
    await expect(inactiveApi.warehouse.getSummary({ actorId: 'inactive-manager' })).rejects.toThrow(
      'warehouse operator',
    );
    await expect(
      inactiveApi.warehouse.approveRequest({ actorId: 'inactive-manager', handoffId: 'HO-1', toolUnitId: 'TL-108' }),
    ).rejects.toThrow('warehouse operator');
    await expect(
      inactiveApi.warehouse.acceptReturn({ actorId: 'inactive-manager', handoffId: 'HO-1', toolUnitId: 'TL-108' }),
    ).rejects.toThrow('warehouse operator');
    await expect(
      inactiveApi.warehouse.declineQueueItem({
        actorId: 'inactive-manager',
        handoffId: 'HO-1',
        toolUnitId: 'TL-108',
      }),
    ).rejects.toThrow('warehouse operator');
  });

  it('rejects wrong-kind, stale, repeated, and declined decisions without corrupting state', async () => {
    const database = createMockDatabase();
    const api = createMockApi(database);
    const before = database.read();
    await expect(
      api.warehouse.approveRequest({ actorId: 'sam-ochoa', handoffId: 'HO-1', toolUnitId: 'TL-109' }),
    ).rejects.toThrow('does not match');
    expect(database.read()).toEqual(before);

    await expect(
      api.warehouse.acceptReturn({ actorId: 'sam-ochoa', handoffId: 'HO-1', toolUnitId: 'TL-108' }),
    ).rejects.toThrow('does not match');
    expect(database.read()).toEqual(before);

    const seedDatabase = createMockDatabase();
    // Model an interleaving external custody change; MockDatabase itself validates
    // each committed snapshot, so this adversarial seam intentionally omits that validation.
    let staleState = structuredClone(seedDatabase.read()) as unknown as MockDatabaseState;
    staleState = {
      ...staleState,
      custody: staleState.custody.map((record) =>
        record.toolUnitId === 'TL-108'
          ? { ...record, holder: { type: 'worker', userId: 'ray-torres' }, sinceAt: '2026-08-19T10:00:00Z' }
          : record,
      ),
    };
    const staleDatabase: MockDatabase = {
      read: () => staleState,
      update: (updater) => {
        staleState = updater(staleState);
      },
      reset: () => undefined,
      clock: seedDatabase.clock,
      nextId: seedDatabase.nextId,
    };
    const staleBefore = structuredClone(staleDatabase.read());
    await expect(
      createMockApi(staleDatabase).warehouse.approveRequest({
        actorId: 'sam-ochoa',
        handoffId: 'HO-1',
        toolUnitId: 'TL-108',
      }),
    ).rejects.toThrow('custody changed');
    expect(staleDatabase.read()).toEqual(staleBefore);

    const declinedDatabase = createMockDatabase({ clock: () => '2026-08-19T11:00:00-06:00' });
    const declinedApi = createMockApi(declinedDatabase);
    const declinedBefore = declinedDatabase.read();
    const receipt = await declinedApi.warehouse.declineQueueItem({
      actorId: 'sam-ochoa',
      handoffId: 'HO-1',
      toolUnitId: 'TL-108',
      evidence: { note: 'Tool is not ready for release' },
    });
    const declinedAfter = declinedDatabase.read();
    expect(receipt).toMatchObject({
      operation: 'decline-queue-item',
      correlationId: 'WH-' + receipt.eventId,
      handoffId: 'HO-1',
      toolUnitId: 'TL-108',
      affectedToolUnitIds: ['TL-108'],
      affectedHandoffIds: ['HO-1'],
    });
    expect(declinedAfter.events).toHaveLength(declinedBefore.events.length + 1);
    expect(declinedAfter.handoffs.find((handoff) => handoff.id === 'HO-1')).toMatchObject({
      status: 'declined',
      resolutionEvidence: { note: 'Tool is not ready for release' },
    });
    expect(declinedAfter.custody.find((record) => record.toolUnitId === 'TL-108')).toEqual(
      declinedBefore.custody.find((record) => record.toolUnitId === 'TL-108'),
    );
    expect(declinedAfter.units.find((unit) => unit.id === 'TL-108')).toEqual(
      declinedBefore.units.find((unit) => unit.id === 'TL-108'),
    );
    await expect(
      declinedApi.warehouse.declineQueueItem({ actorId: 'sam-ochoa', handoffId: 'HO-1', toolUnitId: 'TL-108' }),
    ).rejects.toThrow('already resolved');
    expect(declinedDatabase.read()).toEqual(declinedAfter);
  });
});
