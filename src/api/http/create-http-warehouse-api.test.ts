import { describe, expect, it } from 'vitest';
import { createHttpApi } from './create-http-api';

type RequestRecord = { method: 'GET' | 'POST'; path: string; body?: unknown };

const apiFor = (path: string, payload: unknown, requests: RequestRecord[] = []) =>
  createHttpApi({
    transport: {
      get: async <T>(requested: string) => {
        requests.push({ method: 'GET', path: requested });
        if (requested !== path) throw new Error('unexpected path');
        return payload as T;
      },
      post: async <T>(requested: string, body: unknown) => {
        requests.push({ method: 'POST', path: requested, body });
        if (requested !== path) throw new Error('unexpected path');
        return payload as T;
      },
    },
  });

const queue = {
  handoff_id: 'HO-1',
  kind: 'request',
  tool_unit_id: 'TL-108',
  tool_name: 'Bandsaw',
  image_url: './tool-images/bandsaw.png',
  warehouse_id: 'north-yard',
  warehouse_name: 'North Yard',
  person_id: 'ray-torres',
  person_name: 'Ray Torres',
  person_role: 'Journeyman electrician',
  requested_at: '2026-08-17T10:18:00-06:00',
  from: { kind: 'warehouse', id: 'north-yard', label: 'North Yard' },
  to: { kind: 'worker', id: 'ray-torres', label: 'Ray Torres' },
};

describe('WarehouseApi HTTP boundary', () => {
  it('maps scopes and queue rows with canonical instants', async () => {
    const api = apiFor('/api/warehouse/queue?actor_id=sam-ochoa', [queue]);
    await expect(api.warehouse.listQueue({ actorId: 'sam-ochoa' })).resolves.toMatchObject([
      { id: 'HO-1', requestedAtInstant: queue.requested_at, warehouseId: 'north-yard' },
    ]);
    const scopes = apiFor('/api/warehouse/scopes?actor_id=sam-ochoa', [
      { warehouse_id: 'north-yard', name: 'North Yard', address: '1420 Kerr Ave' },
    ]);
    await expect(scopes.warehouse.listScopes({ actorId: 'sam-ochoa' })).resolves.toEqual([
      { id: 'north-yard', name: 'North Yard', address: '1420 Kerr Ave' },
    ]);

    const scopedRequests: RequestRecord[] = [];
    const scoped = apiFor('/api/warehouse/queue?actor_id=sam-ochoa&warehouse_id=south-shop', [], scopedRequests);
    await scoped.warehouse.listQueue({ actorId: 'sam-ochoa', warehouseId: 'south-shop' });
    expect(scopedRequests).toEqual([
      { method: 'GET', path: '/api/warehouse/queue?actor_id=sam-ochoa&warehouse_id=south-shop' },
    ]);
    const inventoryRequests: RequestRecord[] = [];
    const inventory = apiFor(
      '/api/warehouse/inventory?actor_id=sam-ochoa&warehouse_id=south-shop&include_archived=true',
      [],
      inventoryRequests,
    );
    await inventory.warehouse.listInventory({ actorId: 'sam-ochoa', warehouseId: 'south-shop', includeArchived: true });
    expect(inventoryRequests).toEqual([
      {
        method: 'GET',
        path: '/api/warehouse/inventory?actor_id=sam-ochoa&warehouse_id=south-shop&include_archived=true',
      },
    ]);
  });

  it('rejects malformed queue identities, impossible holder shape, and mismatched receipts', async () => {
    await expect(
      apiFor('/api/warehouse/queue?actor_id=sam-ochoa', [{ ...queue, person_id: ' ' }]).warehouse.listQueue({
        actorId: 'sam-ochoa',
      }),
    ).rejects.toThrow('person id');
    await expect(
      apiFor('/api/warehouse/queue?actor_id=sam-ochoa', [{ ...queue, kind: 'return' }]).warehouse.listQueue({
        actorId: 'sam-ochoa',
      }),
    ).rejects.toThrow('holder shape');
    const receipt = {
      operation: 'approve-request',
      correlation_id: 'WH-EV-7',
      event_id: 'EV-7',
      tool_unit_id: 'TL-108',
      handoff_id: 'HO-1',
      affected_tool_unit_ids: ['TL-108'],
      affected_handoff_ids: ['HO-1'],
    };
    await expect(
      apiFor('/api/warehouse/queue/HO-1/approve', { ...receipt, correlation_id: 'wrong' }).warehouse.approveRequest({
        actorId: 'sam-ochoa',
        handoffId: 'HO-1',
        toolUnitId: 'TL-108',
      }),
    ).rejects.toThrow('correlation');
    await expect(
      apiFor('/api/warehouse/queue/HO-1/approve', { ...receipt, tool_unit_id: undefined }).warehouse.approveRequest({
        actorId: 'sam-ochoa',
        handoffId: 'HO-1',
        toolUnitId: 'TL-108',
      }),
    ).rejects.toThrow('tool id');
    await expect(
      apiFor('/api/warehouse/queue/HO-1/approve', { ...receipt, affected_handoff_ids: [] }).warehouse.approveRequest({
        actorId: 'sam-ochoa',
        handoffId: 'HO-1',
        toolUnitId: 'TL-108',
      }),
    ).rejects.toThrow('handoff ids empty');
    await expect(
      apiFor('/api/warehouse/queue/HO-1/approve', { ...receipt, affected_tool_unit_ids: [] }).warehouse.approveRequest({
        actorId: 'sam-ochoa',
        handoffId: 'HO-1',
        toolUnitId: 'TL-108',
      }),
    ).rejects.toThrow('tool ids empty');
    await expect(
      apiFor('/api/warehouse/queue/HO-1/approve', { ...receipt, tool_unit_id: 'TL-999' }).warehouse.approveRequest({
        actorId: 'sam-ochoa',
        handoffId: 'HO-1',
        toolUnitId: 'TL-108',
      }),
    ).rejects.toThrow('tool correlation');
    await expect(
      apiFor('/api/warehouse/queue/HO-1/approve', { ...receipt, handoff_id: 'HO-999' }).warehouse.approveRequest({
        actorId: 'sam-ochoa',
        handoffId: 'HO-1',
        toolUnitId: 'TL-108',
      }),
    ).rejects.toThrow('handoff correlation');
    await expect(
      apiFor('/api/warehouse/queue/HO-1/approve', {
        ...receipt,
        affected_tool_unit_ids: ['TL-999'],
      }).warehouse.approveRequest({
        actorId: 'sam-ochoa',
        handoffId: 'HO-1',
        toolUnitId: 'TL-108',
      }),
    ).rejects.toThrow('tool subject');
    await expect(
      apiFor('/api/warehouse/queue/HO-1/approve', {
        ...receipt,
        affected_handoff_ids: ['HO-999'],
      }).warehouse.approveRequest({
        actorId: 'sam-ochoa',
        handoffId: 'HO-1',
        toolUnitId: 'TL-108',
      }),
    ).rejects.toThrow('handoff subject');
    await expect(
      apiFor('/api/warehouse/queue/HO-1/approve', {
        ...receipt,
        affected_tool_unit_ids: ['TL-108', 'TL-999'],
      }).warehouse.approveRequest({
        actorId: 'sam-ochoa',
        handoffId: 'HO-1',
        toolUnitId: 'TL-108',
      }),
    ).rejects.toThrow('tool ids unrelated');
    await expect(
      apiFor('/api/warehouse/queue/HO-1/approve', {
        ...receipt,
        affected_handoff_ids: ['HO-1', 'HO-999'],
      }).warehouse.approveRequest({
        actorId: 'sam-ochoa',
        handoffId: 'HO-1',
        toolUnitId: 'TL-108',
      }),
    ).rejects.toThrow('handoff ids unrelated');
  });

  it('maps inventory and summary contracts, rejecting impossible inventory state', async () => {
    const inventory = {
      tool_unit_id: 'TL-108',
      revision: 1,
      tool_name: 'Bandsaw',
      brand: 'Milwaukee',
      model: 'M18',
      category: 'Power tools',
      category_id: 'category-power-tools',
      image_url: './tool-images/bandsaw.png',
      warehouse_id: 'north-yard',
      warehouse_name: 'North Yard',
      display_status: 'in-stock',
      condition: 'serviceable',
      lifecycle: 'active',
      holder: { kind: 'warehouse', id: 'north-yard', label: 'North Yard' },
      last_moved_at: '2026-08-17T10:18:00-06:00',
    };
    const api = apiFor('/api/warehouse/inventory?actor_id=sam-ochoa&include_archived=false', [inventory]);
    await expect(api.warehouse.listInventory({ actorId: 'sam-ochoa' })).resolves.toMatchObject([
      { toolUnitId: 'TL-108', status: 'in-stock', warehouseId: 'north-yard' },
    ]);
    const summary = apiFor('/api/warehouse/summary?actor_id=sam-ochoa', {
      queue_count: 1,
      request_count: 1,
      return_count: 0,
      inventory_count: 15,
      flagged_count: 2,
      archived_count: 1,
    });
    await expect(summary.warehouse.getSummary({ actorId: 'sam-ochoa' })).resolves.toEqual({
      queueCount: 1,
      requestCount: 1,
      returnCount: 0,
      inventoryCount: 15,
      flaggedCount: 2,
      archivedCount: 1,
    });
    await expect(
      apiFor('/api/warehouse/inventory?actor_id=sam-ochoa&include_archived=false', [
        { ...inventory, display_status: 'in-stock', holder: { kind: 'worker', id: 'ray-torres', label: 'Ray Torres' } },
      ]).warehouse.listInventory({ actorId: 'sam-ochoa' }),
    ).rejects.toThrow('inventory state');
    await expect(
      apiFor('/api/warehouse/inventory?actor_id=sam-ochoa&include_archived=false', [
        { ...inventory, revision: 0 },
      ]).warehouse.listInventory({
        actorId: 'sam-ochoa',
      }),
    ).rejects.toThrow('inventory revision');
  });

  it('sends all queue commands with scoped bodies and maps correlated receipts', async () => {
    const receipt = (operation: string, eventId: string, toolUnitId: string, handoffId: string) => ({
      operation,
      correlation_id: 'WH-' + eventId,
      event_id: eventId,
      tool_unit_id: toolUnitId,
      handoff_id: handoffId,
      affected_tool_unit_ids: [toolUnitId],
      affected_handoff_ids: [handoffId],
    });
    const requests: RequestRecord[] = [];
    const approve = apiFor(
      '/api/warehouse/queue/HO-1/approve',
      receipt('approve-request', 'EV-7', 'TL-108', 'HO-1'),
      requests,
    );
    await expect(
      approve.warehouse.approveRequest({
        actorId: 'sam-ochoa',
        handoffId: 'HO-1',
        toolUnitId: 'TL-108',
        evidence: {
          note: 'Ready for release',
          photo: { fileName: 'proof.jpg', src: 'data:image/jpeg;base64,cHJvb2Y=' },
        },
      }),
    ).resolves.toMatchObject({ operation: 'approve-request', correlationId: 'WH-EV-7' });
    const accept = apiFor(
      '/api/warehouse/queue/HO-2/accept-return',
      receipt('accept-return', 'EV-8', 'TL-101', 'HO-2'),
      requests,
    );
    await expect(
      accept.warehouse.acceptReturn({
        actorId: 'sam-ochoa',
        handoffId: 'HO-2',
        toolUnitId: 'TL-101',
        evidence: { note: 'Returned to yard' },
      }),
    ).resolves.toMatchObject({ operation: 'accept-return', correlationId: 'WH-EV-8' });
    const decline = apiFor(
      '/api/warehouse/queue/HO-3/decline',
      receipt('decline-queue-item', 'EV-9', 'TL-102', 'HO-3'),
      requests,
    );
    await expect(
      decline.warehouse.declineQueueItem({
        actorId: 'sam-ochoa',
        handoffId: 'HO-3',
        toolUnitId: 'TL-102',
      }),
    ).resolves.toMatchObject({ operation: 'decline-queue-item', correlationId: 'WH-EV-9' });
    expect(requests).toEqual([
      {
        method: 'POST',
        path: '/api/warehouse/queue/HO-1/approve',
        body: {
          actor_id: 'sam-ochoa',
          tool_unit_id: 'TL-108',
          evidence: {
            note: 'Ready for release',
            photo: { file_name: 'proof.jpg', src: 'data:image/jpeg;base64,cHJvb2Y=' },
          },
        },
      },
      {
        method: 'POST',
        path: '/api/warehouse/queue/HO-2/accept-return',
        body: {
          actor_id: 'sam-ochoa',
          tool_unit_id: 'TL-101',
          evidence: { note: 'Returned to yard' },
        },
      },
      {
        method: 'POST',
        path: '/api/warehouse/queue/HO-3/decline',
        body: { actor_id: 'sam-ochoa', tool_unit_id: 'TL-102' },
      },
    ]);
  });
});
