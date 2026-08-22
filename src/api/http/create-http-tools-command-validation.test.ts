import { describe, expect, it } from 'vitest';
import { createHttpApi } from './create-http-api';
import { validTool } from './http-validation-fixtures';

describe('createHttpApi tool commands', () => {
  it('posts warehouse stock as one batch command and validates every receipt', async () => {
    const calls: Array<{ path: string; body: unknown }> = [];
    const api = createHttpApi({
      transport: {
        get: async <T>() => [] as T,
        post: async <T>(path: string, body: unknown) => {
          calls.push({ path, body });
          return ['TL-301', 'TL-302'].map((toolId) => ({
            ...validTool,
            tool_id: toolId,
            display_status: 'in-stock',
            holder: { kind: 'warehouse', id: 'south-shop', label: 'South Shop' },
          })) as T;
        },
      },
    });
    const input = (model: string) => ({
      actorId: 'morgan-price',
      definition: {
        name: 'Conduit bender',
        brand: 'Greenlee',
        model,
        categoryId: 'category-hand-tools',
        imageKey: 'tool-photo-placeholder.svg',
      },
      warehouseId: 'south-shop',
      destination: 'warehouse' as const,
      photoCaptured: false,
    });

    await expect(api.tools.createTools([input('B-1'), input('B-2')])).resolves.toHaveLength(2);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      path: '/api/tools/batch',
      body: {
        tools: [
          { actor_id: 'morgan-price', warehouse_id: 'south-shop', destination: 'warehouse' },
          { actor_id: 'morgan-price', warehouse_id: 'south-shop', destination: 'warehouse' },
        ],
      },
    });
  });

  it('posts a normalized create-tool command and maps the created unit', async () => {
    const calls: Array<{ path: string; body: unknown }> = [];
    const api = createHttpApi({
      transport: {
        get: async <T>() => [] as T,
        post: async <T>(path: string, body: unknown) => {
          calls.push({ path, body });
          return {
            ...validTool,
            tool_id: 'TL-201',
            display_status: 'checked-out',
            holder: { kind: 'worker', id: 'ray-torres', label: 'Ray Torres' },
          } as T;
        },
      },
    });
    await expect(
      api.tools.createTool({
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
        evidence: { note: '  captured  ' },
      }),
    ).resolves.toMatchObject({ id: 'TL-201', name: 'Hammer drill' });
    expect(calls).toEqual([
      {
        path: '/api/tools',
        body: {
          actor_id: 'ray-torres',
          definition: {
            name: 'Field clamp',
            brand: 'Klein',
            model: 'FC-1',
            category_id: 'category-hand-tools',
            image_key: 'hammer-drill.png',
          },
          warehouse_id: 'north-yard',
          photo_captured: true,
          evidence: { note: 'captured' },
        },
      },
    ]);
  });

  it('rejects a created-tool receipt that does not place custody with the actor', async () => {
    const api = createHttpApi({
      transport: {
        get: async <T>() => [] as T,
        post: async <T>() =>
          ({
            ...validTool,
            tool_id: 'TL-201',
            display_status: 'checked-out',
            holder: { kind: 'worker', id: 'jordan-lee', label: 'Jordan Lee' },
          }) as T,
      },
    });
    await expect(
      api.tools.createTool({
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
      }),
    ).rejects.toThrow('created tool custody');
  });

  it('trims optional serial and price fields and omits blank values like the mock command', async () => {
    const calls: Array<{ body: unknown }> = [];
    const api = createHttpApi({
      transport: {
        get: async <T>() => [] as T,
        post: async <T>(_path: string, body: unknown) => {
          calls.push({ body });
          return {
            ...validTool,
            tool_id: 'TL-201',
            display_status: 'checked-out',
            holder: { kind: 'worker', id: 'ray-torres', label: 'Ray Torres' },
          } as T;
        },
      },
    });
    await api.tools.createTool({
      actorId: ' ray-torres ',
      definition: {
        name: ' Field clamp ',
        brand: ' Klein ',
        model: ' FC-1 ',
        categoryId: 'category-hand-tools',
        imageKey: ' hammer-drill.png ',
      },
      warehouseId: ' north-yard ',
      photoCaptured: true,
      serial: '  S-1  ',
      price: '   ',
    });
    expect(calls[0]?.body).toMatchObject({
      actor_id: 'ray-torres',
      warehouse_id: 'north-yard',
      definition: {
        name: 'Field clamp',
        brand: 'Klein',
        model: 'FC-1',
        category_id: 'category-hand-tools',
        image_key: 'hammer-drill.png',
      },
      serial: 'S-1',
    });
    expect(calls[0]?.body).not.toHaveProperty('price');
  });

  it('rejects malformed create-tool receipts through the command adapter', async () => {
    const malformedReceipts = [
      { ...validTool, tool_id: '' },
      { ...validTool, last_moved_at: 'not-an-instant' },
      { ...validTool, display_status: 'in-stock' },
      {
        ...validTool,
        display_status: 'checked-out',
        holder: { kind: 'warehouse', id: 'north-yard', label: 'North Yard' },
      },
    ];
    for (const response of malformedReceipts) {
      const api = createHttpApi({
        transport: {
          get: async <T>() => [] as T,
          post: async <T>() => response as T,
        },
      });
      await expect(
        api.tools.createTool({
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
        }),
      ).rejects.toThrow('Invalid API response');
    }
  });
});
