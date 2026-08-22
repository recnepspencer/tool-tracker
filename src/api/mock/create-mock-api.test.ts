import { describe, expect, it } from 'vitest';
import { createMockApi } from './create-mock-api';
import { createMockDatabase } from './mock-database';

describe('createMockApi tool and activity projections', () => {
  it('projects canonical units, holders, warehouse counts, and referential events', async () => {
    const api = createMockApi();
    const tools = await api.tools.listTools();
    const summary = await api.admin.getSummary({ actorId: 'sam-ochoa' });
    expect(tools[0]).toMatchObject({
      id: 'TL-101',
      name: 'Hammer drill',
      imageSrc: './tool-images/hammer-drill.jpg',
      status: 'checked-out',
      holder: { type: 'worker', userId: 'ray-torres', name: 'Ray Torres' },
    });
    expect(tools[4]).toMatchObject({
      id: 'TL-105',
      name: 'Rotary hammer',
      imageSrc: './tool-images/rotary-hammer.jpg',
      status: 'in-stock',
      holder: { type: 'warehouse', warehouseId: 'north-yard', name: 'North Yard' },
    });
    expect(tools.map((tool) => tool.id)).toEqual([
      'TL-101',
      'TL-102',
      'TL-103',
      'TL-104',
      'TL-105',
      'TL-106',
      'TL-107',
      'TL-108',
      'TL-109',
      'TL-110',
      'TL-111',
      'TL-112',
      'TL-113',
      'TL-114',
      'TL-115',
      'TL-116',
      'TL-117',
      'TL-118',
      'TL-119',
      'TL-120',
    ]);
    const workerHolders = tools.filter((tool) => tool.holder.type === 'worker').map((tool) => tool.holder.name);
    expect(workerHolders).toHaveLength(8);
    expect(workerHolders.filter((name) => name === 'Ray Torres')).toHaveLength(7);
    expect(workerHolders.filter((name) => name === 'Eli Warren')).toHaveLength(1);
    expect(summary).toMatchObject({ totalTools: 20, checkedOut: 8, inStock: 11, flagged: 2 });
    expect(summary.warehouses.map(({ id, tools: stock, out }) => ({ id, stock, out }))).toEqual([
      { id: 'north-yard', stock: 4, out: 4 },
      { id: 'south-shop', stock: 4, out: 3 },
      { id: 'riverside-depot', stock: 4, out: 1 },
    ]);
    expect(summary.recentEvents).toEqual([
      expect.objectContaining({ id: 'EV-SEED-11', toolName: 'Hydraulic bender' }),
      expect.objectContaining({ id: 'EV-SEED-10', toolName: 'Fiberglass step ladder, 8 ft' }),
      expect.objectContaining({ id: 'EV-SEED-8', toolName: 'Circuit tracer' }),
      expect.objectContaining({ id: 'EV-SEED-7', toolName: 'Cord reel, 100 ft' }),
      expect.objectContaining({ id: 'EV-4', toolName: 'Bandsaw' }),
      expect.objectContaining({ id: 'EV-1', toolName: 'Rotary hammer' }),
    ]);
  });

  it('projects catalog groups, unit details, activity, and pending handoffs from canonical state', async () => {
    const api = createMockApi();
    const catalog = await api.tools.listCatalog();
    expect(catalog).toHaveLength(15);
    expect(catalog.find((item) => item.name === 'Hammer drill')).toMatchObject({
      id: 'def-hammer-drill',
      totalCount: 4,
      availableCount: 2,
      checkedOutCount: 2,
      unitIds: ['TL-101', 'TL-103', 'TL-117', 'TL-118'],
      units: [
        { id: 'TL-101', warehouseId: 'north-yard', status: 'checked-out' },
        { id: 'TL-103', warehouseId: 'north-yard', status: 'checked-out' },
        { id: 'TL-117', warehouseId: 'south-shop', status: 'in-stock' },
        { id: 'TL-118', warehouseId: 'riverside-depot', status: 'in-stock' },
      ],
      warehouses: [
        { id: 'north-yard', name: 'North Yard', unitCount: 2 },
        { id: 'south-shop', name: 'South Shop', unitCount: 1 },
        { id: 'riverside-depot', name: 'Riverside Depot', unitCount: 1 },
      ],
    });
    const detail = await api.tools.getToolDetail('TL-105');
    expect(detail).toMatchObject({
      tool: {
        id: 'TL-105',
        name: 'Rotary hammer',
        holder: { type: 'warehouse', name: 'North Yard' },
        lastMovedAt: '2026-08-04T10:00:00-06:00',
      },
      originWarehouse: { id: 'north-yard', name: 'North Yard' },
      condition: 'serviceable',
      lifecycle: 'active',
      timeline: [{ id: 'EV-1', action: 'Added a tool to inventory' }],
    });
    expect((await api.activity.listActivity()).map((event) => event.id)).toEqual([
      'EV-SEED-11',
      'EV-SEED-10',
      'EV-SEED-8',
      'EV-SEED-7',
      'EV-4',
      'EV-1',
      'EV-2',
      'EV-3',
      'EV-5',
    ]);
    await expect(api.custody.listPendingHandoffs('ray-torres')).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'HO-1',
          toolUnitId: 'TL-108',
          toolName: 'Bandsaw',
          requestedAt: 'Aug 17, 2026, 10:18 AM',
          requestedAtInstant: '2026-08-17T10:18:00-06:00',
          canEdit: false,
        }),
        expect.objectContaining({ id: 'HO-DEMO-OUT', toolUnitId: 'TL-120', canEdit: true }),
        expect.objectContaining({ id: 'HO-DEMO-IN', toolUnitId: 'TL-119', canEdit: false }),
      ]),
    );
    await expect(api.tools.getToolDetail('TL-111')).resolves.toMatchObject({
      tool: { status: 'lost' },
      condition: 'lost',
    });
    await expect(api.tools.getToolDetail('missing')).rejects.toThrow('not available');
  });

  it('orders a unit timeline by canonical timestamps instead of insertion order', async () => {
    const database = createMockDatabase();
    database.update((state) => ({
      ...state,
      events: [
        ...state.events,
        {
          id: 'EV-200',
          actorId: 'sam-ochoa',
          action: 'Reconciled the rotary hammer',
          toolUnitId: 'TL-105',
          kind: 'admin',
          scope: 'warehouse',
          participantIds: [],
          warehouseId: 'north-yard',
          occurredAt: '2026-08-17T17:12:00Z',
        },
      ],
    }));
    const timeline = (await createMockApi(database).tools.getToolDetail('TL-105')).timeline;
    expect(timeline.map((event) => event.id)).toEqual(['EV-200', 'EV-1']);
  });

  it('projects archived unit detail consistently with the HTTP read model', async () => {
    const database = createMockDatabase();
    database.update((state) => ({
      ...state,
      units: state.units.map((unit) => (unit.id === 'TL-105' ? { ...unit, lifecycle: 'archived' } : unit)),
    }));
    const api = createMockApi(database);
    expect((await api.tools.listTools()).some((tool) => tool.id === 'TL-105')).toBe(false);
    expect((await api.tools.listCatalog()).some((item) => item.id === 'def-rotary-hammer')).toBe(false);
    await expect(api.tools.getToolDetail('TL-105')).resolves.toMatchObject({
      tool: { id: 'TL-105' },
      lifecycle: 'archived',
    });
  });

  it('derives mock activity display time from occurredAt instead of stale seed copy', async () => {
    const database = createMockDatabase();
    database.update((state) => ({
      ...state,
      events: state.events.map((event) =>
        event.id === 'EV-1' ? Object.assign({ ...event }, { time: 'Yesterday · 1:00 am' }) : event,
      ),
    }));
    const event = (await createMockApi(database).activity.listActivity()).find(({ id }) => id === 'EV-1');
    expect(event?.time).toBe('Aug 17, 2026, 9:12 AM');
  });

  it('uses current warehouse custody for catalog location and explicit event warehouse metadata', async () => {
    const database = createMockDatabase();
    database.update((state) => ({
      ...state,
      units: state.units.map((unit) => (unit.id === 'TL-105' ? { ...unit, assignedWarehouseId: 'south-shop' } : unit)),
      custody: state.custody.map((record) =>
        record.toolUnitId === 'TL-105'
          ? { ...record, holder: { type: 'warehouse', warehouseId: 'south-shop' } }
          : record,
      ),
      events: state.events.map((event) => (event.id === 'EV-1' ? { ...event, warehouseId: 'south-shop' } : event)),
    }));
    const api = createMockApi(database);
    const rotary = (await api.tools.listCatalog()).find((item) => item.id === 'def-rotary-hammer');
    expect(rotary?.units).toEqual([{ id: 'TL-105', warehouseId: 'south-shop', status: 'in-stock' }]);
    expect(rotary?.warehouses).toEqual([{ id: 'south-shop', name: 'South Shop', unitCount: 1 }]);
    await expect(api.activity.listActivity()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'EV-1', warehouseId: 'south-shop' })]),
    );
  });

  it('isolates nested participant read models from canonical event state', async () => {
    const database = createMockDatabase();
    const activity = await createMockApi(database).activity.listActivity();
    activity[0].participantIds.push('nested-mutation');
    expect((await createMockApi(database).activity.listActivity())[0].participantIds).not.toContain('nested-mutation');
    expect(database.read().events.find((event) => event.id === activity[0].id)?.participantIds).not.toContain(
      'nested-mutation',
    );
  });
});
