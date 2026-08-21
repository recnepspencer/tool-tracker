import { describe, expect, it } from 'vitest';
import { createHttpApi } from './create-http-api';

type Request = { path: string; body: unknown };

const receipt = (operation: string) => ({
  operation,
  correlation_id: 'WH-EV-44',
  event_id: 'EV-44',
  tool_unit_id: 'TL-101',
  affected_tool_unit_ids: ['TL-101'],
  affected_handoff_ids: [],
});

const apiFor = (path: string, payload: unknown, requests: Request[]) =>
  createHttpApi({
    transport: {
      get: async <T>() => payload as T,
      post: async <T>(requestedPath: string, body: unknown) => {
        requests.push({ path: requestedPath, body });
        if (requestedPath !== path) throw new Error('unexpected path');
        return payload as T;
      },
    },
  });

describe('WarehouseApi HTTP inventory decisions', () => {
  it('maps force-return and decommission receipts without inventing a handoff', async () => {
    const requests: Request[] = [];
    const returned = apiFor('/api/warehouse/tools/TL-101/return', receipt('return-tool'), requests);
    await expect(
      returned.warehouse.returnTool({
        actorId: 'sam-ochoa',
        toolUnitId: 'TL-101',
        expectedRevision: 1,
        evidence: { note: 'Yard return' },
      }),
    ).resolves.toMatchObject({ operation: 'return-tool', affectedHandoffIds: [] });
    const archived = apiFor('/api/warehouse/tools/TL-101/decommission', receipt('decommission-tool'), requests);
    await expect(
      archived.warehouse.decommissionTool({ actorId: 'sam-ochoa', toolUnitId: 'TL-101', expectedRevision: 1 }),
    ).resolves.toMatchObject({
      operation: 'decommission-tool',
    });
    expect(requests).toEqual([
      {
        path: '/api/warehouse/tools/TL-101/return',
        body: {
          actor_id: 'sam-ochoa',
          tool_unit_id: 'TL-101',
          expected_revision: 1,
          evidence: { note: 'Yard return' },
        },
      },
      {
        path: '/api/warehouse/tools/TL-101/decommission',
        body: { actor_id: 'sam-ochoa', tool_unit_id: 'TL-101', expected_revision: 1 },
      },
    ]);
  });

  it('rejects a handoff subject on standalone lifecycle receipts', async () => {
    const requests: Request[] = [];
    await expect(
      apiFor(
        '/api/warehouse/tools/TL-101/decommission',
        { ...receipt('decommission-tool'), handoff_id: 'HO-1' },
        requests,
      ).warehouse.decommissionTool({ actorId: 'sam-ochoa', toolUnitId: 'TL-101', expectedRevision: 1 }),
    ).rejects.toThrow('unexpected warehouse mutation handoff id');
  });

  it('rejects unrelated affected IDs for standalone lifecycle receipts', async () => {
    const requests: Request[] = [];
    await expect(
      apiFor(
        '/api/warehouse/tools/TL-101/decommission',
        { ...receipt('decommission-tool'), affected_tool_unit_ids: ['TL-101', 'TL-999'] },
        requests,
      ).warehouse.decommissionTool({ actorId: 'sam-ochoa', toolUnitId: 'TL-101', expectedRevision: 1 }),
    ).rejects.toThrow('tool ids unrelated');
    await expect(
      apiFor(
        '/api/warehouse/tools/TL-101/decommission',
        { ...receipt('decommission-tool'), affected_handoff_ids: ['HO-1'] },
        requests,
      ).warehouse.decommissionTool({ actorId: 'sam-ochoa', toolUnitId: 'TL-101', expectedRevision: 1 }),
    ).rejects.toThrow('unexpected warehouse mutation handoff ids');
  });

  it('rejects standalone receipts with wrong operation, subject, or correlation', async () => {
    const requests: Request[] = [];
    await expect(
      apiFor('/api/warehouse/tools/TL-101/return', receipt('decommission-tool'), requests).warehouse.returnTool({
        actorId: 'sam-ochoa',
        toolUnitId: 'TL-101',
        expectedRevision: 1,
      }),
    ).rejects.toThrow('warehouse mutation operation');
    await expect(
      apiFor(
        '/api/warehouse/tools/TL-101/return',
        { ...receipt('return-tool'), tool_unit_id: 'TL-999' },
        requests,
      ).warehouse.returnTool({
        actorId: 'sam-ochoa',
        toolUnitId: 'TL-101',
        expectedRevision: 1,
      }),
    ).rejects.toThrow('warehouse mutation tool correlation');
    await expect(
      apiFor(
        '/api/warehouse/tools/TL-101/return',
        { ...receipt('return-tool'), correlation_id: 'WH-EV-99' },
        requests,
      ).warehouse.returnTool({
        actorId: 'sam-ochoa',
        toolUnitId: 'TL-101',
        expectedRevision: 1,
      }),
    ).rejects.toThrow('warehouse mutation correlation');
  });

  it('rejects non-positive lifecycle revisions before transport', async () => {
    const requests: Request[] = [];
    await expect(
      apiFor('/api/warehouse/tools/TL-101/return', receipt('return-tool'), requests).warehouse.returnTool({
        actorId: 'sam-ochoa',
        toolUnitId: 'TL-101',
        expectedRevision: 0,
      }),
    ).rejects.toThrow('Expected revision');
    expect(requests).toEqual([]);
  });

  it('rejects standalone receipts whose affected subject does not match the route', async () => {
    const requests: Request[] = [];
    await expect(
      apiFor(
        '/api/warehouse/tools/TL-101/return',
        { ...receipt('return-tool'), affected_tool_unit_ids: ['TL-999'] },
        requests,
      ).warehouse.returnTool({ actorId: 'sam-ochoa', toolUnitId: 'TL-101', expectedRevision: 1 }),
    ).rejects.toThrow('warehouse mutation tool subject');
  });

  it('normalizes lifecycle identities before transport', async () => {
    const requests: Request[] = [];
    await apiFor('/api/warehouse/tools/TL-101/return', receipt('return-tool'), requests).warehouse.returnTool({
      actorId: ' sam-ochoa ',
      toolUnitId: ' TL-101 ',
      expectedRevision: 1,
    });
    expect(requests[0]).toEqual({
      path: '/api/warehouse/tools/TL-101/return',
      body: { actor_id: 'sam-ochoa', tool_unit_id: 'TL-101', expected_revision: 1 },
    });
  });
});
