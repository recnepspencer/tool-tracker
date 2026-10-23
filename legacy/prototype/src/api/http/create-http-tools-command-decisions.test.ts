import { describe, expect, it } from 'vitest';
import { createHttpApi } from './create-http-api';
import type { HolderRef } from '../../domain/custody';

type RequestRecord = { method: 'GET' | 'POST'; path: string; body?: unknown };

const tool = {
  tool_id: 'TL-101',
  revision: 1,
  display_name: 'Hammer drill',
  manufacturer: 'DeWalt',
  model: 'DCD996',
  category: 'Power tools',
  image_url: './tool-images/hammer-drill.png',
  display_status: 'in-stock',
  holder: { kind: 'warehouse', id: 'north-yard', label: 'North Yard' },
  last_moved_at: '2026-08-20T09:00:00-06:00',
};

const updatedTool = { ...tool, revision: 2 };
const expectedWarehouse = { type: 'warehouse', warehouseId: 'north-yard' } satisfies HolderRef;

const apiFor = (path: string, payload: unknown, requests: RequestRecord[]) =>
  createHttpApi({
    transport: {
      get: async <T>() => payload as T,
      post: async <T>(requestedPath: string, body: unknown) => {
        requests.push({ method: 'POST', path: requestedPath, body });
        if (requestedPath !== path) throw new Error('unexpected path');
        return payload as T;
      },
    },
  });

describe('ToolsApi HTTP decision commands', () => {
  it('maps edit, flag, and restore commands with strict paths and evidence bodies', async () => {
    const requests: RequestRecord[] = [];
    const update = apiFor('/api/tools/TL-101/update', updatedTool, requests);
    await expect(
      update.tools.updateTool({
        actorId: 'sam-ochoa',
        toolUnitId: 'TL-101',
        expectedRevision: 1,
        expectedStatus: 'in-stock',
        expectedHolder: expectedWarehouse,
        definition: {
          name: 'Hammer drill',
          brand: 'DeWalt',
          model: 'DCD996',
          categoryId: 'category-power-tools',
          imageKey: 'hammer-drill.png',
        },
        serial: ' S-1 ',
        evidence: { note: 'Catalog review' },
      }),
    ).resolves.toMatchObject({
      id: 'TL-101',
      revision: 2,
      name: 'Hammer drill',
      brand: 'DeWalt',
      model: 'DCD996',
      category: 'Power tools',
      imageSrc: './tool-images/hammer-drill.png',
    });
    const flag = apiFor('/api/tools/TL-101/flag', { ...updatedTool, display_status: 'damaged' }, requests);
    await expect(
      flag.tools.flagTool({
        actorId: 'sam-ochoa',
        toolUnitId: 'TL-101',
        expectedRevision: 1,
        expectedHolder: expectedWarehouse,
        condition: 'damaged',
        evidence: { note: 'Crack' },
      }),
    ).resolves.toMatchObject({ id: 'TL-101', status: 'damaged' });
    const restore = apiFor('/api/tools/TL-101/restore', updatedTool, requests);
    await expect(
      restore.tools.restoreTool({
        actorId: 'sam-ochoa',
        toolUnitId: 'TL-101',
        expectedRevision: 1,
        expectedHolder: expectedWarehouse,
      }),
    ).resolves.toMatchObject({
      id: 'TL-101',
    });
    expect(requests).toEqual([
      {
        method: 'POST',
        path: '/api/tools/TL-101/update',
        body: {
          actor_id: 'sam-ochoa',
          definition: {
            name: 'Hammer drill',
            brand: 'DeWalt',
            model: 'DCD996',
            category_id: 'category-power-tools',
            image_key: 'hammer-drill.png',
          },
          expected_revision: 1,
          expected_status: 'in-stock',
          expected_holder: { kind: 'warehouse', id: 'north-yard' },
          serial: 'S-1',
          evidence: { note: 'Catalog review' },
        },
      },
      {
        method: 'POST',
        path: '/api/tools/TL-101/flag',
        body: {
          actor_id: 'sam-ochoa',
          condition: 'damaged',
          expected_revision: 1,
          expected_holder: { kind: 'warehouse', id: 'north-yard' },
          evidence: { note: 'Crack' },
        },
      },
      {
        method: 'POST',
        path: '/api/tools/TL-101/restore',
        body: {
          actor_id: 'sam-ochoa',
          expected_revision: 1,
          expected_holder: { kind: 'warehouse', id: 'north-yard' },
        },
      },
    ]);
  });

  it('rejects command receipts with wrong unit identity or flag status', async () => {
    const requests: RequestRecord[] = [];
    await expect(
      apiFor('/api/tools/TL-101/update', { ...tool, tool_id: 'TL-999' }, requests).tools.updateTool({
        actorId: 'sam-ochoa',
        toolUnitId: 'TL-101',
        expectedRevision: 1,
        expectedStatus: 'in-stock',
        expectedHolder: expectedWarehouse,
        definition: {
          name: 'Hammer drill',
          brand: 'DeWalt',
          model: 'DCD996',
          categoryId: 'category-power-tools',
          imageKey: 'hammer-drill.png',
        },
      }),
    ).rejects.toThrow('updated tool id correlation');
    await expect(
      apiFor('/api/tools/TL-101/flag', { ...updatedTool, display_status: 'in-stock' }, requests).tools.flagTool({
        actorId: 'sam-ochoa',
        toolUnitId: 'TL-101',
        expectedRevision: 1,
        expectedHolder: expectedWarehouse,
        condition: 'lost',
      }),
    ).rejects.toThrow('flagged tool status');
    await expect(
      apiFor('/api/tools/TL-101/restore', { ...updatedTool, display_status: 'damaged' }, requests).tools.restoreTool({
        actorId: 'sam-ochoa',
        toolUnitId: 'TL-101',
        expectedRevision: 1,
        expectedHolder: expectedWarehouse,
      }),
    ).rejects.toThrow('restored tool status');
  });

  it('rejects flag and restore receipts that rewrite the holder', async () => {
    const requests: RequestRecord[] = [];
    await expect(
      apiFor(
        '/api/tools/TL-101/flag',
        {
          ...updatedTool,
          display_status: 'damaged',
          holder: { kind: 'worker', id: 'ray-torres', label: 'Ray Torres' },
        },
        requests,
      ).tools.flagTool({
        actorId: 'sam-ochoa',
        toolUnitId: 'TL-101',
        expectedRevision: 1,
        expectedHolder: expectedWarehouse,
        condition: 'damaged',
      }),
    ).rejects.toThrow('flagged tool holder preservation');
    await expect(
      apiFor(
        '/api/tools/TL-101/restore',
        { ...updatedTool, holder: { kind: 'warehouse', id: 'south-shop', label: 'South Shop' } },
        requests,
      ).tools.restoreTool({
        actorId: 'sam-ochoa',
        toolUnitId: 'TL-101',
        expectedRevision: 1,
        expectedHolder: expectedWarehouse,
      }),
    ).rejects.toThrow('restored tool holder preservation');
  });

  it('rejects a command receipt that does not advance the submitted revision', async () => {
    const requests: RequestRecord[] = [];
    await expect(
      apiFor('/api/tools/TL-101/update', tool, requests).tools.updateTool({
        actorId: 'sam-ochoa',
        toolUnitId: 'TL-101',
        expectedRevision: 1,
        expectedStatus: 'in-stock',
        expectedHolder: expectedWarehouse,
        definition: {
          name: 'Hammer drill',
          brand: 'DeWalt',
          model: 'DCD996',
          categoryId: 'category-power-tools',
          imageKey: 'hammer-drill.png',
        },
      }),
    ).rejects.toThrow('updated tool revision');
  });

  it('rejects a coherent receipt that rewrites custody during a definition edit', async () => {
    const requests: RequestRecord[] = [];
    await expect(
      apiFor(
        '/api/tools/TL-101/update',
        {
          ...updatedTool,
          holder: { kind: 'worker', id: 'ray-torres', label: 'Ray Torres' },
          display_status: 'checked-out',
        },
        requests,
      ).tools.updateTool({
        actorId: 'sam-ochoa',
        toolUnitId: 'TL-101',
        expectedRevision: 1,
        expectedStatus: 'in-stock',
        expectedHolder: expectedWarehouse,
        definition: {
          name: 'Hammer drill',
          brand: 'DeWalt',
          model: 'DCD996',
          categoryId: 'category-power-tools',
          imageKey: 'hammer-drill.png',
        },
      }),
    ).rejects.toThrow('updated tool status preservation');
  });

  it('rejects non-positive command revisions before transport', async () => {
    const requests: RequestRecord[] = [];
    await expect(
      apiFor('/api/tools/TL-101/flag', { ...updatedTool, display_status: 'damaged' }, requests).tools.flagTool({
        actorId: 'sam-ochoa',
        toolUnitId: 'TL-101',
        expectedRevision: 0,
        expectedHolder: expectedWarehouse,
        condition: 'damaged',
      }),
    ).rejects.toThrow('Expected revision');
    expect(requests).toEqual([]);
  });

  it('rejects an invalid flag condition before transport', async () => {
    const requests: RequestRecord[] = [];
    await expect(
      apiFor('/api/tools/TL-101/flag', { ...updatedTool, display_status: 'damaged' }, requests).tools.flagTool({
        actorId: 'sam-ochoa',
        toolUnitId: 'TL-101',
        expectedRevision: 1,
        expectedHolder: expectedWarehouse,
        condition: 'serviceable' as never,
      }),
    ).rejects.toThrow('Condition must be damaged or lost');
    expect(requests).toEqual([]);
  });

  it('normalizes update values before sending the HTTP command body', async () => {
    const requests: RequestRecord[] = [];
    await apiFor('/api/tools/TL-101/update', updatedTool, requests).tools.updateTool({
      actorId: ' sam-ochoa ',
      toolUnitId: ' TL-101 ',
      expectedRevision: 1,
      expectedStatus: 'in-stock',
      expectedHolder: expectedWarehouse,
      definition: {
        name: ' Hammer drill ',
        brand: ' DeWalt ',
        model: ' DCD996 ',
        categoryId: 'category-power-tools',
        imageKey: ' hammer-drill.png ',
      },
      serial: ' S-1 ',
      price: ' $100 ',
      evidence: { note: ' Review ' },
    });
    expect(requests[0]).toMatchObject({
      path: '/api/tools/TL-101/update',
      body: {
        actor_id: 'sam-ochoa',
        expected_revision: 1,
        expected_status: 'in-stock',
        expected_holder: { kind: 'warehouse', id: 'north-yard' },
        definition: {
          name: 'Hammer drill',
          brand: 'DeWalt',
          model: 'DCD996',
          category_id: 'category-power-tools',
          image_key: 'hammer-drill.png',
        },
        serial: 'S-1',
        price: '$100',
        evidence: { note: 'Review' },
      },
    });
  });

  it('normalizes flag and restore identities before transport', async () => {
    const requests: RequestRecord[] = [];
    await apiFor('/api/tools/TL-101/flag', { ...updatedTool, display_status: 'damaged' }, requests).tools.flagTool({
      actorId: ' sam-ochoa ',
      toolUnitId: ' TL-101 ',
      expectedRevision: 1,
      expectedHolder: expectedWarehouse,
      condition: 'damaged',
      evidence: { note: ' Flagged ' },
    });
    await apiFor('/api/tools/TL-101/restore', updatedTool, requests).tools.restoreTool({
      actorId: ' sam-ochoa ',
      toolUnitId: ' TL-101 ',
      expectedRevision: 1,
      expectedHolder: expectedWarehouse,
      evidence: { note: ' Restored ' },
    });
    expect(requests).toEqual([
      {
        method: 'POST',
        path: '/api/tools/TL-101/flag',
        body: {
          actor_id: 'sam-ochoa',
          condition: 'damaged',
          expected_revision: 1,
          expected_holder: { kind: 'warehouse', id: 'north-yard' },
          evidence: { note: 'Flagged' },
        },
      },
      {
        method: 'POST',
        path: '/api/tools/TL-101/restore',
        body: {
          actor_id: 'sam-ochoa',
          expected_revision: 1,
          expected_holder: { kind: 'warehouse', id: 'north-yard' },
          evidence: { note: 'Restored' },
        },
      },
    ]);
  });
});
