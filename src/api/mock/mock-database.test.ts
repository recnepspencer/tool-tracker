import { describe, expect, it } from 'vitest';
import { createMockDatabase } from './mock-database';

describe('createMockDatabase', () => {
  it('keeps future mutations deterministic through injected clock and ids', () => {
    const database = createMockDatabase({
      clock: () => '2026-08-17T00:00:00.000Z',
      idGenerator: (prefix) => prefix + '-fixed',
    });
    expect(database.clock()).toBe('2026-08-17T00:00:00.000Z');
    expect(database.nextId('EV')).toBe('EV-fixed');
  });

  it('allocates default IDs around seed collisions and resets deterministically', () => {
    const database = createMockDatabase();
    expect(database.nextId('EV')).toBe('EV-7');
    expect(database.nextId('EV')).toBe('EV-8');
    database.reset();
    expect(database.nextId('EV')).toBe('EV-7');
  });

  it('allocates condition-report IDs around seeded historical reports', () => {
    const database = createMockDatabase();
    expect(database.nextId('CR')).toBe('CR-3');
    database.reset();
    expect(database.nextId('CR')).toBe('CR-3');
  });

  it('can append an event using a default generated ID', () => {
    const database = createMockDatabase();
    const id = database.nextId('EV');
    database.update((state) => ({
      ...state,
      events: [
        ...state.events,
        {
          id,
          actorId: 'sam-ochoa',
          action: 'Added a generated event',
          toolUnitId: 'TL-105',
          warehouseId: 'north-yard',
          kind: 'admin',
          scope: 'admin',
          participantIds: [],
          occurredAt: '2026-08-17T12:00:00Z',
        },
      ],
    }));
    expect(database.read().events.at(-1)?.id).toBe('EV-7');
  });

  it('rejects mutation snapshots with broken references', () => {
    const database = createMockDatabase();
    expect(() =>
      database.update((state) => ({
        ...state,
        custody: state.custody.map((record) =>
          record.toolUnitId === 'TL-101' ? { ...record, holder: { type: 'worker', userId: 'missing' } } : record,
        ),
      })),
    ).toThrow('Invalid custody record');
  });

  it('rejects missing or duplicate custody records', () => {
    const missing = createMockDatabase();
    expect(() =>
      missing.update((state) => ({
        ...state,
        custody: state.custody.filter((record) => record.toolUnitId !== 'TL-101'),
      })),
    ).toThrow('Expected one custody record for tool unit: TL-101');

    const duplicate = createMockDatabase();
    expect(() =>
      duplicate.update((state) => ({
        ...state,
        custody: [...state.custody, state.custody[0]],
      })),
    ).toThrow('Expected one custody record for tool unit: TL-101');
  });

  it('resets mutations to a fresh canonical snapshot', () => {
    const database = createMockDatabase();
    database.update((state) => ({
      ...state,
      warehouses: state.warehouses.map((warehouse) =>
        warehouse.id === 'north-yard' ? { ...warehouse, name: 'North Operations' } : warehouse,
      ),
    }));
    expect(database.read().warehouses[0].name).toBe('North Operations');
    database.reset();
    expect(database.read().warehouses[0].name).toBe('North Yard');
  });

  it('isolates nested holder references between database snapshots', () => {
    const database = createMockDatabase();
    const first = database.read();
    database.update((state) => ({
      ...state,
      units: state.units.map((unit) => (unit.id === 'TL-108' ? { ...unit, assignedWarehouseId: 'south-shop' } : unit)),
      custody: state.custody.map((record) =>
        record.toolUnitId === 'TL-108'
          ? { ...record, holder: { type: 'warehouse', warehouseId: 'south-shop' } }
          : record,
      ),
      handoffs: state.handoffs.map((handoff) =>
        handoff.id === 'HO-1'
          ? {
              ...handoff,
              from: { type: 'warehouse', warehouseId: 'south-shop' },
            }
          : handoff,
      ),
    }));
    expect(first.custody.find((record) => record.toolUnitId === 'TL-108')?.holder).toEqual({
      type: 'warehouse',
      warehouseId: 'north-yard',
    });
    expect(first.handoffs.find((handoff) => handoff.id === 'HO-1')?.from).toEqual({
      type: 'warehouse',
      warehouseId: 'north-yard',
    });
    const second = database.read();
    expect(second.custody.find((record) => record.toolUnitId === 'TL-101')?.holder).toEqual({
      type: 'worker',
      userId: 'ray-torres',
    });
    expect(second.custody.find((record) => record.toolUnitId === 'TL-108')?.holder).toEqual({
      type: 'warehouse',
      warehouseId: 'south-shop',
    });
    expect(second.handoffs.find((handoff) => handoff.id === 'HO-1')?.from).toEqual({
      type: 'warehouse',
      warehouseId: 'south-shop',
    });
  });
});
