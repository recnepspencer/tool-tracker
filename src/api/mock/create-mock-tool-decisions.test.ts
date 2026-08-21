import { describe, expect, it } from 'vitest';
import { createMockApi } from './create-mock-api';
import { createMockDatabase } from './mock-database';
import type { HolderRef } from '../../domain/custody';

const expectedWarehouse = { type: 'warehouse', warehouseId: 'north-yard' } satisfies HolderRef;
const expectedRiverside = { type: 'warehouse', warehouseId: 'riverside-depot' } satisfies HolderRef;
const expectedRay = { type: 'worker', userId: 'ray-torres' } satisfies HolderRef;

const updateInput = {
  toolUnitId: 'TL-105',
  expectedRevision: 1,
  expectedStatus: 'in-stock' as const,
  expectedHolder: expectedWarehouse,
  definition: {
    name: 'Rotary hammer pro',
    brand: 'Bosch',
    model: 'RH-900',
    categoryId: 'category-power-tools',
    imageKey: 'hammer-drill.png',
  },
  serial: ' RH-105 ',
  price: ' $510 ',
  evidence: { note: 'Inventory audit' },
};

describe('mock tool decision commands', () => {
  it('rejects a stale edit token without overwriting the newer definition', async () => {
    const database = createMockDatabase();
    const api = createMockApi(database);
    const base = {
      actorId: 'sam-ochoa',
      toolUnitId: 'TL-105',
      expectedRevision: 1,
      expectedStatus: 'in-stock' as const,
      expectedHolder: expectedWarehouse,
      definition: {
        name: 'First edit',
        brand: 'Bosch',
        model: 'RH-900',
        categoryId: 'category-power-tools',
        imageKey: 'hammer-drill.png',
      },
    };
    await api.tools.updateTool(base);
    const afterFirst = database.read();
    await expect(
      api.tools.updateTool({ ...base, definition: { ...base.definition, name: 'Stale edit' } }),
    ).rejects.toThrow('Tool changed before this decision');
    expect(database.read()).toEqual(afterFirst);
  });

  it('edits, flags, restores, and preserves an auditable condition history', async () => {
    const database = createMockDatabase({ clock: () => '2026-08-20T09:00:00-06:00' });
    const api = createMockApi(database);
    const before = database.read();
    const beforeUnit = before.units.find((unit) => unit.id === 'TL-105');
    const beforeCustody = before.custody.find((record) => record.toolUnitId === 'TL-105');
    expect(beforeUnit).toBeDefined();
    expect(beforeCustody).toBeDefined();
    const updated = await api.tools.updateTool({ actorId: 'sam-ochoa', ...updateInput });
    expect(updated).toMatchObject({
      id: 'TL-105',
      name: 'Rotary hammer pro',
      brand: 'Bosch',
      model: 'RH-900',
      imageSrc: './tool-images/hammer-drill.png',
      serial: 'RH-105',
    });
    expect(database.read().definitions.find((definition) => definition.id === beforeUnit?.definitionId)).toMatchObject({
      id: beforeUnit?.definitionId,
      name: 'Rotary hammer pro',
      brand: 'Bosch',
      model: 'RH-900',
      category: 'Power tools',
      imageKey: 'hammer-drill.png',
    });
    expect(database.read().units.find((unit) => unit.id === 'TL-105')).toMatchObject({
      definitionId: beforeUnit?.definitionId,
      originWarehouseId: beforeUnit?.originWarehouseId,
      assignedWarehouseId: beforeUnit?.assignedWarehouseId,
      lifecycle: beforeUnit?.lifecycle,
      condition: beforeUnit?.condition,
      serial: 'RH-105',
      price: '$510',
    });
    expect(database.read().custody.find((record) => record.toolUnitId === 'TL-105')).toEqual(beforeCustody);
    expect(database.read().events).toHaveLength(before.events.length + 1);

    const flagged = await api.tools.flagTool({
      actorId: 'sam-ochoa',
      toolUnitId: 'TL-105',
      expectedRevision: 2,
      expectedHolder: expectedWarehouse,
      condition: 'damaged',
      evidence: { note: 'Cracked housing' },
    });
    expect(flagged.status).toBe('damaged');
    expect(database.read().custody.find((record) => record.toolUnitId === 'TL-105')).toEqual(beforeCustody);
    expect(database.read().units.find((unit) => unit.id === 'TL-105')).toMatchObject({
      condition: 'damaged',
      lifecycle: beforeUnit?.lifecycle,
      assignedWarehouseId: beforeUnit?.assignedWarehouseId,
      originWarehouseId: beforeUnit?.originWarehouseId,
    });
    expect(database.read().conditionReports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toolUnitId: 'TL-105',
          reporterId: 'sam-ochoa',
          condition: 'damaged',
          reportedAt: '2026-08-20T09:00:00-06:00',
          evidence: { note: 'Cracked housing' },
        }),
      ]),
    );

    const restored = await api.tools.restoreTool({
      actorId: 'sam-ochoa',
      toolUnitId: 'TL-105',
      expectedRevision: 3,
      expectedHolder: expectedWarehouse,
      evidence: { note: 'Repair completed' },
    });
    expect(restored.status).toBe('in-stock');
    expect(database.read().units.find((unit) => unit.id === 'TL-105')?.condition).toBe('serviceable');
    expect(database.read().conditionReports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ toolUnitId: 'TL-105', condition: 'damaged', reporterId: 'sam-ochoa' }),
      ]),
    );
    expect(database.read().events.filter((event) => event.toolUnitId === 'TL-105')).toHaveLength(4);
    expect(database.read().units.find((unit) => unit.id === 'TL-105')).toMatchObject({
      definitionId: beforeUnit?.definitionId,
      originWarehouseId: beforeUnit?.originWarehouseId,
      assignedWarehouseId: beforeUnit?.assignedWarehouseId,
      lifecycle: beforeUnit?.lifecycle,
    });
    expect(database.read().custody.find((record) => record.toolUnitId === 'TL-105')).toEqual(beforeCustody);
  });

  it('rejects unauthorized managers and repeated flagging without changing state', async () => {
    const database = createMockDatabase();
    const api = createMockApi(database);
    const before = database.read();
    await expect(
      api.tools.flagTool({
        actorId: 'morgan-price',
        toolUnitId: 'TL-105',
        expectedRevision: 1,
        expectedHolder: expectedWarehouse,
        condition: 'lost',
      }),
    ).rejects.toThrow('cannot manage that warehouse');
    expect(database.read()).toEqual(before);
    await api.tools.flagTool({
      actorId: 'sam-ochoa',
      toolUnitId: 'TL-105',
      expectedRevision: 1,
      expectedHolder: expectedWarehouse,
      condition: 'lost',
    });
    const flagged = database.read();
    await expect(
      api.tools.flagTool({
        actorId: 'sam-ochoa',
        toolUnitId: 'TL-105',
        expectedRevision: 2,
        expectedHolder: expectedWarehouse,
        condition: 'damaged',
      }),
    ).rejects.toThrow('already flagged');
    expect(database.read()).toEqual(flagged);
  });

  it('rejects an invalid flag condition before any write', async () => {
    const database = createMockDatabase();
    const api = createMockApi(database);
    const before = structuredClone(database.read());
    await expect(
      api.tools.flagTool({
        actorId: 'sam-ochoa',
        toolUnitId: 'TL-105',
        expectedRevision: 1,
        expectedHolder: expectedWarehouse,
        condition: 'serviceable' as never,
      }),
    ).rejects.toThrow('Condition must be damaged or lost');
    expect(database.read()).toEqual(before);
  });

  it('rejects a stale holder precondition without changing state', async () => {
    const database = createMockDatabase();
    const api = createMockApi(database);
    const before = structuredClone(database.read());
    await expect(
      api.tools.flagTool({
        actorId: 'sam-ochoa',
        toolUnitId: 'TL-105',
        expectedRevision: 1,
        expectedHolder: expectedRiverside,
        condition: 'damaged',
      }),
    ).rejects.toThrow('Tool custody changed before this decision');
    expect(database.read()).toEqual(before);
  });

  it('rejects restoring a worker-held unit without changing any state', async () => {
    const database = createMockDatabase();
    const api = createMockApi(database);
    const before = database.read();
    await expect(
      api.tools.restoreTool({
        actorId: 'sam-ochoa',
        toolUnitId: 'TL-101',
        expectedRevision: 1,
        expectedHolder: expectedRay,
      }),
    ).rejects.toThrow('Return the tool to a warehouse');
    expect(database.read()).toEqual(before);
  });

  it('rejects restoring an already-serviceable warehouse unit without changing state', async () => {
    const database = createMockDatabase();
    const api = createMockApi(database);
    const before = structuredClone(database.read());
    await expect(
      api.tools.restoreTool({
        actorId: 'sam-ochoa',
        toolUnitId: 'TL-105',
        expectedRevision: 1,
        expectedHolder: expectedWarehouse,
      }),
    ).rejects.toThrow('already in serviceable condition');
    expect(database.read()).toEqual(before);
  });

  it('rejects every tool decision for a pending handoff without a partial write', async () => {
    const database = createMockDatabase();
    const api = createMockApi(database);
    const before = structuredClone(database.read());
    await expect(
      api.tools.updateTool({
        actorId: 'sam-ochoa',
        toolUnitId: 'TL-108',
        expectedRevision: 1,
        expectedStatus: 'in-stock' as const,
        expectedHolder: expectedWarehouse,
        definition: {
          name: 'Bandsaw revised',
          brand: 'Milwaukee',
          model: 'M18',
          categoryId: 'category-power-tools',
          imageKey: 'bandsaw.png',
        },
      }),
    ).rejects.toThrow('pending handoff');
    await expect(
      api.tools.flagTool({
        actorId: 'sam-ochoa',
        toolUnitId: 'TL-108',
        expectedRevision: 1,
        expectedHolder: expectedWarehouse,
        condition: 'damaged',
      }),
    ).rejects.toThrow('pending handoff');
    await expect(
      api.tools.restoreTool({
        actorId: 'sam-ochoa',
        toolUnitId: 'TL-108',
        expectedRevision: 1,
        expectedHolder: expectedWarehouse,
      }),
    ).rejects.toThrow('pending handoff');
    expect(database.read()).toEqual(before);
  });

  it('rejects stale flag and restore tokens without changing state', async () => {
    const database = createMockDatabase();
    const api = createMockApi(database);
    await api.tools.updateTool({ ...updateInput, actorId: 'sam-ochoa', expectedRevision: 1 });
    const afterEdit = database.read();
    await expect(
      api.tools.flagTool({
        actorId: 'sam-ochoa',
        toolUnitId: 'TL-105',
        expectedRevision: 1,
        expectedHolder: expectedWarehouse,
        condition: 'damaged',
      }),
    ).rejects.toThrow('Tool changed before this decision');
    expect(database.read()).toEqual(afterEdit);

    const beforeRestore = database.read();
    await api.tools.restoreTool({
      actorId: 'sam-ochoa',
      toolUnitId: 'TL-111',
      expectedRevision: 1,
      expectedHolder: expectedRiverside,
    });
    const afterRestore = database.read();
    await expect(
      api.tools.restoreTool({
        actorId: 'sam-ochoa',
        toolUnitId: 'TL-111',
        expectedRevision: 1,
        expectedHolder: expectedRiverside,
      }),
    ).rejects.toThrow('Tool changed before this decision');
    expect(database.read()).not.toEqual(beforeRestore);
    expect(database.read()).toEqual(afterRestore);
  });

  it('normalizes flag and restore identities like the HTTP adapter', async () => {
    const database = createMockDatabase();
    const api = createMockApi(database);
    const flagged = await api.tools.flagTool({
      actorId: ' sam-ochoa ',
      toolUnitId: ' TL-105 ',
      expectedRevision: 1,
      expectedHolder: expectedWarehouse,
      condition: 'damaged',
      evidence: { note: ' Flagged ' },
    });
    expect(flagged.id).toBe('TL-105');
    const restored = await api.tools.restoreTool({
      actorId: ' sam-ochoa ',
      toolUnitId: ' TL-105 ',
      expectedRevision: 2,
      expectedHolder: expectedWarehouse,
      evidence: { note: ' Restored ' },
    });
    expect(restored.id).toBe('TL-105');
    expect(database.read().events.at(-1)?.evidence).toEqual({ note: 'Restored' });
  });
});
