import { describe, expect, it } from 'vitest';
import { createMockApi } from './create-mock-api';
import { createMockDatabase } from './mock-database';

describe('createMockApi admin projections', () => {
  it('keeps warehouse summary names connected to canonical state', async () => {
    const database = createMockDatabase();
    database.update((state) => ({
      ...state,
      warehouses: state.warehouses.map((warehouse) =>
        warehouse.id === 'north-yard' ? { ...warehouse, name: 'North Operations' } : warehouse,
      ),
    }));
    const api = createMockApi(database);
    expect((await api.admin.getSummary({ actorId: 'sam-ochoa' })).warehouses[0].name).toBe('North Operations');
  });

  it('excludes archived units from warehouse coverage projections', async () => {
    const database = createMockDatabase();
    database.update((state) => ({
      ...state,
      units: state.units.map((unit) => (unit.id === 'TL-105' ? { ...unit, lifecycle: 'archived' } : unit)),
    }));
    const summary = await createMockApi(database).admin.getSummary({ actorId: 'sam-ochoa' });
    expect(summary.totalTools).toBe(19);
    expect(summary.warehouses[0]).toMatchObject({ tools: 3, out: 4 });
  });

  it('reconciles every summary aggregate with canonical active custody', async () => {
    const database = createMockDatabase();
    const state = database.read();
    const activeUnits = state.units.filter((unit) => unit.lifecycle === 'active');
    const activeUnitIds = new Set(activeUnits.map((unit) => unit.id));
    const activeCustody = state.custody.filter((record) => activeUnitIds.has(record.toolUnitId));
    const checkedOut = activeCustody.filter((record) => record.holder.type === 'worker').length;
    const warehouseHeld = activeCustody.filter((record) => record.holder.type === 'warehouse').length;
    const inStock = activeCustody.filter((record) => {
      const unit = activeUnits.find((candidate) => candidate.id === record.toolUnitId);
      return record.holder.type === 'warehouse' && unit?.condition === 'serviceable';
    }).length;
    const flagged = activeUnits.filter((unit) => unit.condition === 'damaged' || unit.condition === 'lost').length;
    const summary = await createMockApi(database).admin.getSummary({ actorId: 'sam-ochoa' });
    expect(summary.totalTools).toBe(activeUnits.length);
    expect(summary.checkedOut).toBe(checkedOut);
    expect(summary.inStock).toBe(inStock);
    expect(summary.flagged).toBe(flagged);
    expect(summary.warehouses.reduce((total, warehouse) => total + warehouse.tools, 0)).toBe(warehouseHeld);
    expect(summary.warehouses.reduce((total, warehouse) => total + warehouse.out, 0)).toBe(checkedOut);
    expect(summary.warehouses.reduce((total, warehouse) => total + warehouse.tools + warehouse.out, 0)).toBe(
      activeUnits.length,
    );
  });

  it('orders recent movement by canonical event instants instead of insertion order', async () => {
    const database = createMockDatabase();
    database.update((state) => ({ ...state, events: [...state.events].reverse() }));
    const summary = await createMockApi(database).admin.getSummary({ actorId: 'sam-ochoa' });
    expect(summary.recentEvents.map((event) => event.id)).toEqual([
      'EV-SEED-11',
      'EV-SEED-10',
      'EV-SEED-8',
      'EV-SEED-7',
      'EV-4',
      'EV-1',
    ]);
    expect(summary.recentEvents[0].timestamp).toBe('2026-08-18T09:20:00-06:00');
  });
});
