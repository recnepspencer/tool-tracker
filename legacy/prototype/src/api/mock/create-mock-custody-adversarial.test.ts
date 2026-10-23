import { describe, expect, it } from 'vitest';
import { createMockApi } from './create-mock-api';
import { createMockDatabase } from './mock-database';

describe('createMockApi custody adversarial commands', () => {
  it('rejects unknown actors and keeps the state unchanged', async () => {
    const database = createMockDatabase();
    const api = createMockApi(database);
    const before = database.read();
    await expect(api.custody.requestTool({ toolUnitId: 'TL-105', actorId: 'unknown-actor' })).rejects.toThrow(
      'Unknown actor',
    );
    await expect(
      api.custody.startTransfer({
        toolUnitId: 'TL-101',
        actorId: 'unknown-actor',
        to: { type: 'warehouse', warehouseId: 'south-shop' },
      }),
    ).rejects.toThrow('Unknown actor');
    await expect(api.custody.listTransferTargets({ actorId: 'unknown-actor', toolUnitId: 'TL-101' })).rejects.toThrow(
      'Unknown actor',
    );
    expect(database.read()).toEqual(before);
  });

  it('rejects all worker commands for archived units', async () => {
    const database = createMockDatabase();
    database.update((state) => ({
      ...state,
      units: state.units.map((unit) => (unit.id === 'TL-101' ? { ...unit, lifecycle: 'archived' as const } : unit)),
    }));
    const api = createMockApi(database);
    const before = database.read();
    await expect(
      api.custody.startTransfer({
        toolUnitId: 'TL-101',
        actorId: 'ray-torres',
        to: { type: 'warehouse', warehouseId: 'south-shop' },
      }),
    ).rejects.toThrow('archived');
    await expect(
      api.custody.reportToolCondition({
        toolUnitId: 'TL-101',
        actorId: 'ray-torres',
        condition: 'damaged',
      }),
    ).rejects.toThrow('archived');
    expect(database.read()).toEqual(before);
  });

  it('rejects same-holder and unknown destinations while allowing damaged return to a warehouse', async () => {
    const database = createMockDatabase();
    const api = createMockApi(database);
    await expect(
      api.custody.startTransfer({
        toolUnitId: 'TL-101',
        actorId: 'ray-torres',
        to: { type: 'worker', userId: 'ray-torres' },
      }),
    ).rejects.toThrow('destination');
    await expect(
      api.custody.startTransfer({
        toolUnitId: 'TL-101',
        actorId: 'ray-torres',
        to: { type: 'worker', userId: 'unknown-worker' },
      }),
    ).rejects.toThrow('destination');
    const damagedReturn = await api.custody.startTransfer({
      toolUnitId: 'TL-104',
      actorId: 'ray-torres',
      to: { type: 'warehouse', warehouseId: 'riverside-depot' },
    });
    expect(damagedReturn.status).toBe('pending');
    expect((await api.custody.listPendingHandoffs('ray-torres')).some(({ id }) => id === damagedReturn.handoffId)).toBe(
      true,
    );
  });

  it('returns no transfer targets while a handoff is already pending', async () => {
    const api = createMockApi();
    const started = await api.custody.startTransfer({
      toolUnitId: 'TL-101',
      actorId: 'ray-torres',
      to: { type: 'warehouse', warehouseId: 'south-shop' },
    });
    await expect(api.custody.listTransferTargets({ actorId: 'ray-torres', toolUnitId: 'TL-101' })).resolves.toEqual([]);
    expect(started.status).toBe('pending');
  });

  it('rejects repeated condition reports after the first transition', async () => {
    const api = createMockApi();
    await api.custody.reportToolCondition({ toolUnitId: 'TL-101', actorId: 'ray-torres', condition: 'damaged' });
    await expect(
      api.custody.reportToolCondition({ toolUnitId: 'TL-101', actorId: 'ray-torres', condition: 'lost' }),
    ).rejects.toThrow('already been reported');
  });
});
