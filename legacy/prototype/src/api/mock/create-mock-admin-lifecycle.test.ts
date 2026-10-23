import { describe, expect, it } from 'vitest';
import { createMockApi } from './create-mock-api';
import { createMockDatabase } from './mock-database';

const custodyFixture = () => {
  const database = createMockDatabase({ clock: () => '2026-08-18T12:00:00Z' });
  database.update((state) => {
    state.custody = state.custody.map((record) =>
      record.toolUnitId === 'TL-115'
        ? { ...record, holder: { type: 'worker', userId: 'avery-cole' }, sinceAt: '2026-08-01T12:00:00Z' }
        : record,
    );
    state.handoffs.push({
      id: 'HO-2',
      kind: 'transfer',
      toolUnitId: 'TL-115',
      from: { type: 'worker', userId: 'avery-cole' },
      to: { type: 'warehouse', warehouseId: 'north-yard' },
      requestedBy: 'avery-cole',
      requestedAt: '2026-08-18T10:00:00Z',
      status: 'pending',
    });
    state.events.push({
      id: 'EV-7',
      actorId: 'avery-cole',
      action: 'Received test custody fixture',
      toolUnitId: 'TL-115',
      kind: 'custody',
      scope: 'worker',
      participantIds: ['avery-cole'],
      warehouseId: 'north-yard',
      occurredAt: '2026-08-01T12:00:00Z',
    });
    return state;
  });
  return database;
};

describe('admin lifecycle custody history', () => {
  it('suspends a member, voids pending work, and preserves the void audit event', async () => {
    const database = custodyFixture();
    const result = await createMockApi(database).admin.setPersonAccess!({
      actorId: 'sam-ochoa',
      personId: 'avery-cole',
      access: 'suspended',
    });
    expect(result).toMatchObject({
      operation: 'set-person-access',
      personId: 'avery-cole',
      affectedToolUnitIds: ['TL-115'],
      affectedHandoffIds: ['HO-2'],
    });
    expect(database.read().handoffs.find((handoff) => handoff.id === 'HO-2')).toMatchObject({
      status: 'cancelled',
      resolvedBy: 'sam-ochoa',
      resolvedAt: '2026-08-18T12:00:00Z',
    });
    expect(database.read().custody.find((record) => record.toolUnitId === 'TL-115')?.holder).toEqual({
      type: 'worker',
      userId: 'avery-cole',
    });
    expect(database.read().events.at(-1)).toMatchObject({
      id: result.eventId,
      action: 'Suspended Avery Cole',
      actorId: 'sam-ochoa',
      kind: 'admin',
    });
    expect(database.read().events.find((event) => event.action === 'Voided handoff HO-2')).toMatchObject({
      toolUnitId: 'TL-115',
      warehouseId: 'north-yard',
      participantIds: ['sam-ochoa', 'avery-cole'],
      occurredAt: '2026-08-18T12:00:00Z',
    });
  });

  it('removes a member, returns custody home, voids work, and retains all history', async () => {
    const database = custodyFixture();
    const result = await createMockApi(database).admin.removePerson!({
      actorId: 'sam-ochoa',
      personId: 'avery-cole',
      reason: 'Contract ended',
      note: ' Keep custody history ',
    });
    expect(result).toMatchObject({
      personId: 'avery-cole',
      affectedToolUnitIds: ['TL-115'],
      affectedHandoffIds: ['HO-2'],
    });
    expect(database.read().users.find((user) => user.id === 'avery-cole')?.lifecycle).toBe('removed');
    expect(database.read().custody.find((record) => record.toolUnitId === 'TL-115')?.holder).toEqual({
      type: 'warehouse',
      warehouseId: 'south-shop',
    });
    expect(database.read().handoffs.find((handoff) => handoff.id === 'HO-2')).toMatchObject({
      status: 'cancelled',
      resolvedBy: 'sam-ochoa',
    });
    expect(database.read().events.some((event) => event.id === 'EV-7')).toBe(true);
    expect(database.read().events.at(-1)).toMatchObject({
      id: result.eventId,
      action: 'Removed Avery Cole: Contract ended',
      participantIds: ['sam-ochoa', 'avery-cole'],
      evidence: { note: 'Keep custody history' },
    });
    expect(database.read().events.find((event) => event.action === 'Voided handoff HO-2')).toMatchObject({
      toolUnitId: 'TL-115',
      warehouseId: 'north-yard',
      participantIds: ['sam-ochoa', 'avery-cole'],
      occurredAt: '2026-08-18T12:00:00Z',
    });
    expect(database.read().events.find((event) => event.action === 'Returned TL-115 from Avery Cole')).toMatchObject({
      toolUnitId: 'TL-115',
      warehouseId: 'south-shop',
      participantIds: ['sam-ochoa', 'avery-cole'],
      occurredAt: '2026-08-18T12:00:00Z',
    });
  });

  it('does not move archived custody when removing a member', async () => {
    const database = custodyFixture();
    database.update((state) => {
      state.handoffs = [];
      state.units = state.units.map((unit) => (unit.id === 'TL-115' ? { ...unit, lifecycle: 'archived' } : unit));
      return state;
    });
    const result = await createMockApi(database).admin.removePerson!({
      actorId: 'sam-ochoa',
      personId: 'avery-cole',
      reason: 'Contract ended',
    });
    expect(result.affectedToolUnitIds).toEqual([]);
    expect(database.read().custody.find((record) => record.toolUnitId === 'TL-115')?.holder).toEqual({
      type: 'worker',
      userId: 'avery-cole',
    });
    expect(database.read().events.some((event) => event.action === 'Returned TL-115 from Avery Cole')).toBe(false);
  });

  it('does not record a custody return for a warehouse request the member never held', async () => {
    const database = createMockDatabase({ clock: () => '2026-08-18T12:00:00Z' });
    database.update((state) => ({
      ...state,
      handoffs: [
        ...state.handoffs,
        {
          id: 'HO-8',
          kind: 'warehouse-request',
          toolUnitId: 'TL-105',
          from: { type: 'warehouse', warehouseId: 'north-yard' },
          to: { type: 'worker', userId: 'avery-cole' },
          requestedBy: 'avery-cole',
          requestedAt: '2026-08-18T11:00:00Z',
          status: 'pending',
        },
      ],
    }));
    const result = await createMockApi(database).admin.removePerson!({
      actorId: 'sam-ochoa',
      personId: 'avery-cole',
      reason: 'Contract ended',
    });
    expect(result.affectedToolUnitIds).toEqual(['TL-105']);
    expect(database.read().events.find((event) => event.action === 'Voided handoff HO-8')).toMatchObject({
      toolUnitId: 'TL-105',
    });
    expect(database.read().events.some((event) => event.action === 'Returned TL-105 from Avery Cole')).toBe(false);
    expect(database.read().custody.find((record) => record.toolUnitId === 'TL-105')?.holder).toEqual({
      type: 'warehouse',
      warehouseId: 'north-yard',
    });
  });

  it('uses the reassigned current warehouse for a worker-to-worker void audit', async () => {
    const database = createMockDatabase({ clock: () => '2026-08-18T12:00:00Z' });
    database.update((state) => ({
      ...state,
      units: state.units.map((unit) => (unit.id === 'TL-115' ? { ...unit, assignedWarehouseId: 'south-shop' } : unit)),
      custody: state.custody.map((record) =>
        record.toolUnitId === 'TL-115'
          ? { ...record, holder: { type: 'worker', userId: 'avery-cole' }, sinceAt: '2026-08-01T12:00:00Z' }
          : record,
      ),
      handoffs: [
        ...state.handoffs,
        {
          id: 'HO-9',
          kind: 'transfer',
          toolUnitId: 'TL-115',
          from: { type: 'worker', userId: 'avery-cole' },
          to: { type: 'worker', userId: 'ray-torres' },
          requestedBy: 'avery-cole',
          requestedAt: '2026-08-18T10:00:00Z',
          status: 'pending',
        },
      ],
    }));
    await createMockApi(database).admin.setPersonAccess!({
      actorId: 'sam-ochoa',
      personId: 'avery-cole',
      access: 'suspended',
    });
    expect(database.read().events.find((event) => event.action === 'Voided handoff HO-9')).toMatchObject({
      toolUnitId: 'TL-115',
      warehouseId: 'south-shop',
    });
  });
});
