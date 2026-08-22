import { describe, expect, it } from 'vitest';
import { createMockApi } from './create-mock-api';
import { createMockDatabase } from './mock-database';
import type { HolderRef } from '../../domain/custody';

const expectedWarehouse = { type: 'warehouse', warehouseId: 'north-yard' } satisfies HolderRef;
const expectedRay = { type: 'worker', userId: 'ray-torres' } satisfies HolderRef;

describe('mock warehouse inventory decisions', () => {
  it('returns a checked-out unit and decommissions a warehouse-held unit with receipts', async () => {
    const database = createMockDatabase({ clock: () => '2026-08-20T09:00:00-06:00' });
    const api = createMockApi(database);
    const beforeReturn = database.read();
    const returned = await api.warehouse.returnTool({
      actorId: 'sam-ochoa',
      toolUnitId: 'TL-104',
      expectedRevision: 1,
    });
    const afterReturn = database.read();
    expect(returned).toMatchObject({ operation: 'return-tool', toolUnitId: 'TL-104', affectedHandoffIds: [] });
    expect(afterReturn.handoffs).toEqual(beforeReturn.handoffs);
    expect(afterReturn.custody.find((record) => record.toolUnitId === 'TL-104')?.holder).toEqual({
      type: 'warehouse',
      warehouseId: 'riverside-depot',
    });
    const origin = afterReturn.units.find((unit) => unit.id === 'TL-104')?.originWarehouseId;
    expect(origin).toBe('riverside-depot');

    const archived = await api.warehouse.decommissionTool({
      actorId: 'sam-ochoa',
      toolUnitId: 'TL-104',
      expectedRevision: 2,
    });
    expect(archived).toMatchObject({ operation: 'decommission-tool', toolUnitId: 'TL-104', affectedHandoffIds: [] });
    expect(database.read().units.find((unit) => unit.id === 'TL-104')?.lifecycle).toBe('archived');
    expect(database.read().events.filter((event) => event.toolUnitId === 'TL-104')).toHaveLength(3);
  });

  it('fails closed for a manager outside scope and for decommissioning a worker-held tool', async () => {
    const database = createMockDatabase();
    const api = createMockApi(database);
    const before = database.read();
    await expect(
      api.warehouse.returnTool({ actorId: 'morgan-price', toolUnitId: 'TL-101', expectedRevision: 1 }),
    ).rejects.toThrow('cannot manage that warehouse');
    expect(database.read()).toEqual(before);
    await expect(
      api.warehouse.returnTool({ actorId: 'sam-ochoa', toolUnitId: 'TL-101', expectedRevision: 1 }),
    ).rejects.toThrow('only available for a flagged tool');
    expect(database.read()).toEqual(before);
    await expect(
      api.warehouse.decommissionTool({ actorId: 'sam-ochoa', toolUnitId: 'TL-101', expectedRevision: 1 }),
    ).rejects.toThrow('Return the tool to a warehouse');
    expect(database.read()).toEqual(before);

    const outOfScopeDatabase = createMockDatabase();
    const outOfScopeApi = createMockApi(outOfScopeDatabase);
    await outOfScopeApi.warehouse.returnTool({ actorId: 'sam-ochoa', toolUnitId: 'TL-104', expectedRevision: 1 });
    const beforeOutOfScopeDecommission = outOfScopeDatabase.read();
    await expect(
      outOfScopeApi.warehouse.decommissionTool({ actorId: 'morgan-price', toolUnitId: 'TL-104', expectedRevision: 2 }),
    ).rejects.toThrow('cannot manage that warehouse');
    expect(outOfScopeDatabase.read()).toEqual(beforeOutOfScopeDecommission);
  });

  it('preserves resolved handoff history when decommissioning after a warehouse return', async () => {
    const database = createMockDatabase({ clock: () => '2026-08-20T09:00:00-06:00' });
    const api = createMockApi(database);
    const approved = await api.warehouse.approveRequest({
      actorId: 'sam-ochoa',
      handoffId: 'HO-1',
      toolUnitId: 'TL-108',
    });
    const flagged = await api.tools.flagTool({
      actorId: 'sam-ochoa',
      toolUnitId: 'TL-108',
      expectedRevision: 2,
      expectedHolder: expectedRay,
      condition: 'damaged',
      evidence: { note: 'Return required after damage review' },
    });
    const returned = await api.warehouse.returnTool({
      actorId: 'sam-ochoa',
      toolUnitId: 'TL-108',
      expectedRevision: 3,
    });
    const archived = await api.warehouse.decommissionTool({
      actorId: 'sam-ochoa',
      toolUnitId: 'TL-108',
      expectedRevision: 4,
    });
    const state = database.read();
    expect(approved.affectedHandoffIds).toEqual(['HO-1']);
    expect(flagged.status).toBe('damaged');
    expect(returned.affectedHandoffIds).toEqual([]);
    expect(archived.affectedHandoffIds).toEqual([]);
    expect(state.units.find((unit) => unit.id === 'TL-108')?.lifecycle).toBe('archived');
    expect(state.handoffs.find((handoff) => handoff.id === 'HO-1')).toMatchObject({
      status: 'accepted',
      resolvedBy: 'sam-ochoa',
    });
    expect(state.events.filter((event) => event.toolUnitId === 'TL-108')).toHaveLength(5);
    expect(state.conditionReports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ toolUnitId: 'TL-108', condition: 'damaged', reporterId: 'sam-ochoa' }),
      ]),
    );
    expect(state.events.map((event) => event.id)).toEqual(expect.arrayContaining([returned.eventId, archived.eventId]));
  });

  it('returns to the assigned warehouse while retaining origin and exact receipts', async () => {
    const database = createMockDatabase({ clock: () => '2026-08-20T09:00:00-06:00' });
    const api = createMockApi(database);
    const started = await api.custody.startTransfer({
      actorId: 'ray-torres',
      toolUnitId: 'TL-104',
      to: { type: 'warehouse', warehouseId: 'south-shop' },
    });
    await api.warehouse.acceptReturn({
      actorId: 'morgan-price',
      handoffId: started.handoffId!,
      toolUnitId: 'TL-104',
    });
    await api.tools.restoreTool({
      actorId: 'morgan-price',
      toolUnitId: 'TL-104',
      expectedRevision: 2,
      expectedHolder: { type: 'warehouse', warehouseId: 'south-shop' },
    });
    const requested = await api.custody.requestTool({ actorId: 'ray-torres', toolUnitId: 'TL-104' });
    await api.warehouse.approveRequest({
      actorId: 'morgan-price',
      handoffId: requested.handoffId!,
      toolUnitId: 'TL-104',
    });
    await api.tools.flagTool({
      actorId: 'morgan-price',
      toolUnitId: 'TL-104',
      expectedRevision: 4,
      expectedHolder: { type: 'worker', userId: 'ray-torres' },
      condition: 'damaged',
    });
    const returned = await api.warehouse.returnTool({
      actorId: 'morgan-price',
      toolUnitId: 'TL-104',
      expectedRevision: 5,
    });
    expect(returned).toMatchObject({
      operation: 'return-tool',
      correlationId: 'WH-' + returned.eventId,
      eventId: returned.eventId,
      toolUnitId: 'TL-104',
      affectedToolUnitIds: ['TL-104'],
      affectedHandoffIds: [],
    });
    const returnedState = database.read();
    expect(returnedState.custody.find((record) => record.toolUnitId === 'TL-104')?.holder).toEqual({
      type: 'warehouse',
      warehouseId: 'south-shop',
    });
    expect(returnedState.units.find((unit) => unit.id === 'TL-104')).toMatchObject({
      originWarehouseId: 'riverside-depot',
      assignedWarehouseId: 'south-shop',
      lifecycle: 'active',
    });
    expect(returnedState.events.at(-1)).toMatchObject({
      id: returned.eventId,
      actorId: 'morgan-price',
      warehouseId: 'south-shop',
      kind: 'custody',
    });
    const beforeDecommission = database.read();
    const beforeDecommissionUnit = beforeDecommission.units.find((unit) => unit.id === 'TL-104');
    const beforeDecommissionDefinition = beforeDecommission.definitions.find(
      (definition) => definition.id === beforeDecommissionUnit?.definitionId,
    );
    expect(beforeDecommissionUnit).toBeDefined();
    expect(beforeDecommissionDefinition).toBeDefined();
    const archived = await api.warehouse.decommissionTool({
      actorId: 'morgan-price',
      toolUnitId: 'TL-104',
      expectedRevision: 6,
    });
    expect(archived).toMatchObject({
      operation: 'decommission-tool',
      correlationId: 'WH-' + archived.eventId,
      eventId: archived.eventId,
      toolUnitId: 'TL-104',
      affectedToolUnitIds: ['TL-104'],
      affectedHandoffIds: [],
    });
    const afterDecommission = database.read();
    expect(afterDecommission.units.find((unit) => unit.id === 'TL-104')).toEqual({
      ...beforeDecommissionUnit,
      lifecycle: 'archived',
      revision: (beforeDecommissionUnit?.revision ?? 1) + 1,
    });
    expect(
      afterDecommission.definitions.find((definition) => definition.id === beforeDecommissionUnit?.definitionId),
    ).toEqual({
      ...beforeDecommissionDefinition,
      revision: (beforeDecommissionDefinition?.revision ?? 1) + 1,
    });
    expect(afterDecommission.units.filter((unit) => unit.id !== 'TL-104')).toEqual(
      beforeDecommission.units.filter((unit) => unit.id !== 'TL-104'),
    );
    expect(
      afterDecommission.definitions.filter((definition) => definition.id !== beforeDecommissionUnit?.definitionId),
    ).toEqual(
      beforeDecommission.definitions.filter((definition) => definition.id !== beforeDecommissionUnit?.definitionId),
    );
    expect(afterDecommission.custody).toEqual(beforeDecommission.custody);
    expect(afterDecommission.handoffs).toEqual(beforeDecommission.handoffs);
    expect(afterDecommission.conditionReports).toEqual(beforeDecommission.conditionReports);
    expect(afterDecommission.events.slice(0, beforeDecommission.events.length)).toEqual(beforeDecommission.events);
    expect(afterDecommission.events).toHaveLength(beforeDecommission.events.length + 1);
    expect(afterDecommission.events.at(-1)).toMatchObject({
      id: archived.eventId,
      actorId: 'morgan-price',
      warehouseId: 'south-shop',
      kind: 'admin',
    });
  });

  it('rejects stale return and decommission tokens without a second write', async () => {
    const database = createMockDatabase();
    const api = createMockApi(database);
    await api.warehouse.returnTool({ actorId: 'sam-ochoa', toolUnitId: 'TL-104', expectedRevision: 1 });
    const afterReturn = database.read();
    await expect(
      api.warehouse.returnTool({ actorId: 'sam-ochoa', toolUnitId: 'TL-104', expectedRevision: 1 }),
    ).rejects.toThrow('Tool changed before this decision');
    expect(database.read()).toEqual(afterReturn);
    await api.tools.updateTool({
      actorId: 'sam-ochoa',
      toolUnitId: 'TL-105',
      expectedRevision: 1,
      expectedStatus: 'in-stock' as const,
      expectedHolder: expectedWarehouse,
      definition: {
        name: 'Rotary hammer revised',
        brand: 'Bosch',
        model: 'RH-900',
        categoryId: 'category-power-tools',
        imageKey: 'hammer-drill.png',
      },
    });
    const afterEdit = database.read();
    await expect(
      api.warehouse.decommissionTool({ actorId: 'sam-ochoa', toolUnitId: 'TL-105', expectedRevision: 1 }),
    ).rejects.toThrow('Tool changed before this decision');
    expect(database.read()).toEqual(afterEdit);
  });

  it('normalizes lifecycle identities like the HTTP adapter', async () => {
    const database = createMockDatabase();
    const api = createMockApi(database);
    const returned = await api.warehouse.returnTool({
      actorId: ' sam-ochoa ',
      toolUnitId: ' TL-104 ',
      expectedRevision: 1,
    });
    expect(returned.toolUnitId).toBe('TL-104');
    expect(database.read().custody.find((record) => record.toolUnitId === 'TL-104')?.holder.type).toBe('warehouse');
  });

  it('rejects every lifecycle decision for a pending handoff without a partial write', async () => {
    const database = createMockDatabase();
    const api = createMockApi(database);
    const before = structuredClone(database.read());
    await expect(
      api.warehouse.returnTool({ actorId: 'sam-ochoa', toolUnitId: 'TL-108', expectedRevision: 1 }),
    ).rejects.toThrow('pending handoff');
    await expect(
      api.warehouse.decommissionTool({ actorId: 'sam-ochoa', toolUnitId: 'TL-108', expectedRevision: 1 }),
    ).rejects.toThrow('pending handoff');
    expect(database.read()).toEqual(before);
  });
});
