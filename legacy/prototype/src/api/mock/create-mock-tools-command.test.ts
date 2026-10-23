import { describe, expect, it } from 'vitest';
import { createMockApi } from './create-mock-api';
import { createMockDatabase } from './mock-database';

describe('createMockApi tool creation commands', () => {
  it('creates warehouse units individually, enforces scope, and groups matching definitions', async () => {
    const database = createMockDatabase({ clock: () => '2026-08-18T09:00:00-06:00' });
    const api = createMockApi(database);
    const warehouseTool = (warehouseId: string, serial: string) => ({
      actorId: 'morgan-price',
      definition: {
        name: 'Conduit bender',
        brand: 'Greenlee',
        model: 'B-1',
        categoryId: 'category-hand-tools',
        imageKey: 'tool-photo-placeholder.svg',
      },
      warehouseId,
      destination: 'warehouse' as const,
      photoCaptured: false,
      serial,
    });
    const before = database.read();

    await expect(api.tools.createTool(warehouseTool('north-yard', 'CB-1'))).rejects.toThrow(
      'cannot manage that warehouse',
    );
    expect(database.read()).toEqual(before);

    const first = await api.tools.createTool(warehouseTool('south-shop', 'CB-1'));
    const second = await api.tools.createTool(warehouseTool('south-shop', 'CB-2'));
    expect(first.id).not.toBe(second.id);
    const catalogGroup = (await api.tools.listCatalog()).find(
      (item) => item.name === 'Conduit bender' && item.model === 'B-1',
    );
    expect(catalogGroup?.units.map((unit) => unit.id)).toEqual([first.id, second.id]);
    expect(
      database
        .read()
        .events.filter((event) => event.toolUnitId !== undefined && [first.id, second.id].includes(event.toolUnitId)),
    ).toHaveLength(2);
  });

  it('creates a captured tool through the shared adapter and projects it everywhere', async () => {
    const database = createMockDatabase({ clock: () => '2026-08-18T09:00:00-06:00' });
    const api = createMockApi(database);
    const created = await api.tools.createTool({
      actorId: 'ray-torres',
      definition: {
        name: 'Field clamp',
        brand: 'Klein',
        model: 'CL-1',
        categoryId: 'category-hand-tools',
        imageKey: 'hammer-drill.png',
      },
      warehouseId: 'north-yard',
      photoCaptured: true,
      evidence: {
        note: 'Captured at the truck',
        photo: { fileName: 'proof.jpg', src: 'data:image/jpeg;base64,cHJvb2Y=' },
      },
    });
    expect(created.name).toBe('Field clamp');
    expect((await api.tools.listTools()).some((tool) => tool.id === created.id)).toBe(true);
    expect((await api.activity.listActivity()).find((event) => event.toolUnitId === created.id)).toMatchObject({
      action: "Added Field clamp to Ray Torres's tools",
      evidence: {
        note: 'Captured at the truck',
        photo: { fileName: 'proof.jpg', src: 'data:image/jpeg;base64,cHJvb2Y=' },
      },
    });
    await expect(
      api.tools.createTool({
        actorId: 'ray-torres',
        definition: {
          name: '',
          brand: 'Klein',
          model: 'CL-1',
          categoryId: 'category-hand-tools',
          imageKey: 'hammer-drill.png',
        },
        warehouseId: 'north-yard',
        photoCaptured: true,
      }),
    ).rejects.toThrow('Tool name is required');
  });

  it('keeps tool creation atomic, worker-authorized, and definition-normalized', async () => {
    const database = createMockDatabase({ clock: () => '2026-08-18T09:00:00-06:00' });
    const api = createMockApi(database);
    const before = database.read();
    await expect(
      api.tools.createTool({
        actorId: 'sam-ochoa',
        definition: {
          name: 'Unauthorized tool',
          brand: 'Brand',
          model: 'Model',
          categoryId: 'category-hand-tools',
          imageKey: 'hammer-drill.png',
        },
        warehouseId: 'north-yard',
        photoCaptured: true,
      }),
    ).rejects.toThrow('Only a worker');
    await expect(
      api.tools.createTool({
        actorId: 'ray-torres',
        definition: {
          name: 'Missing warehouse tool',
          brand: 'Brand',
          model: 'Model',
          categoryId: 'category-hand-tools',
          imageKey: 'hammer-drill.png',
        },
        warehouseId: 'missing-yard',
        photoCaptured: true,
      }),
    ).rejects.toThrow('Warehouse not found');
    await expect(
      api.tools.createTool({
        actorId: 'ray-torres',
        definition: {
          name: 'Uncaptured tool',
          brand: 'Brand',
          model: 'Model',
          categoryId: 'category-hand-tools',
          imageKey: 'hammer-drill.png',
        },
        warehouseId: 'north-yard',
        photoCaptured: false,
      }),
    ).rejects.toThrow('A tool photo is required');
    expect(database.read()).toEqual(before);
    const first = await api.tools.createTool({
      actorId: 'ray-torres',
      definition: {
        name: 'Field clamp',
        brand: 'Klein',
        model: 'FC-1',
        categoryId: 'category-hand-tools',
        imageKey: 'hammer-drill.png',
      },
      warehouseId: 'north-yard',
      photoCaptured: true,
      serial: '  S-1  ',
      price: '   ',
    });
    const definitionsAfterFirst = database.read().definitions.length;
    const second = await api.tools.createTool({
      actorId: 'ray-torres',
      definition: {
        name: ' field clamp ',
        brand: ' klein ',
        model: ' FC-1 ',
        categoryId: 'category-hand-tools',
        imageKey: 'hammer-drill.png',
      },
      warehouseId: 'north-yard',
      photoCaptured: true,
    });
    expect(database.read().definitions).toHaveLength(definitionsAfterFirst);
    expect(second.name).toBe(first.name);
    expect(database.read().units.find((unit) => unit.id === first.id)).toMatchObject({ serial: 'S-1' });
    expect(database.read().units.find((unit) => unit.id === first.id)).not.toHaveProperty('price');
    expect(database.read().custody.filter((record) => record.toolUnitId === second.id)[0]?.holder).toEqual({
      type: 'worker',
      userId: 'ray-torres',
    });
    expect(database.read().events.filter((event) => event.toolUnitId === second.id)).toHaveLength(1);
  });

  it('rejects malformed destinations instead of treating them as worker custody', async () => {
    const database = createMockDatabase();
    const api = createMockApi(database);
    const before = database.read();
    await expect(
      api.tools.createTool({
        actorId: 'ray-torres',
        definition: {
          name: 'Malformed destination tool',
          brand: 'Klein',
          model: 'MD-1',
          categoryId: 'category-hand-tools',
          imageKey: 'hammer-drill.png',
        },
        warehouseId: 'north-yard',
        photoCaptured: true,
        destination: 'truck' as unknown as 'worker',
      }),
    ).rejects.toThrow('destination must be worker or warehouse');
    expect(database.read()).toEqual(before);
  });

  it('keeps tool creation on the canonical warehouse id when its display name changes', async () => {
    const database = createMockDatabase();
    database.update((state) => ({
      ...state,
      warehouses: state.warehouses.map((warehouse) =>
        warehouse.id === 'north-yard' ? { ...warehouse, name: 'North Operations' } : warehouse,
      ),
    }));
    const api = createMockApi(database);
    const session = await api.auth.signInAs('ray-torres');
    expect(session.homeWarehouseId).toBe('north-yard');
    const created = await api.tools.createTool({
      actorId: session.profileId,
      definition: {
        name: 'Canonical location tool',
        brand: 'Klein',
        model: 'CL-2',
        categoryId: 'category-hand-tools',
        imageKey: 'hammer-drill.png',
      },
      warehouseId: session.homeWarehouseId,
      photoCaptured: true,
    });
    expect(database.read().units.find((unit) => unit.id === created.id)?.originWarehouseId).toBe('north-yard');
  });
});
