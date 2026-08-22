import { describe, expect, it } from 'vitest';
import { createHttpApi } from './create-http-api';

const mutation = { handoff_id: 'HO-9', tool_unit_id: 'TL-101', event_id: 'EV-9', status: 'pending' } as const;

describe('createHttpApi custody commands', () => {
  it('maps command receipts and transfer targets through the focused port', async () => {
    const calls: Array<{ path: string; body: unknown }> = [];
    const api = createHttpApi({
      transport: {
        get: async <T>(path: string) => {
          calls.push({ path, body: undefined });
          return [{ kind: 'warehouse', id: 'south-shop', label: 'South Shop' }] as T;
        },
        post: async <T>(path: string, body: unknown) => {
          calls.push({ path, body });
          return mutation as T;
        },
      },
    });
    await expect(api.custody.requestTool({ toolUnitId: 'TL-101', actorId: 'ray-torres' })).resolves.toEqual({
      handoffId: 'HO-9',
      toolUnitId: 'TL-101',
      eventId: 'EV-9',
      status: 'pending',
    });
    await expect(api.custody.listTransferTargets({ actorId: 'ray-torres', toolUnitId: 'TL-101' })).resolves.toEqual([
      { type: 'warehouse', warehouseId: 'south-shop', name: 'South Shop' },
    ]);
    expect(calls[0]).toMatchObject({ path: '/api/tools/TL-101/request', body: { actor_id: 'ray-torres' } });
    expect(calls[1].path).toBe('/api/tools/TL-101/transfer-targets?actor_id=ray-torres');
  });

  it('maps successful receipts and exact request bodies for every custody command', async () => {
    const operations = [
      {
        path: '/api/tools/TL-101/transfer',
        body: {
          actor_id: 'ray-torres',
          to: { kind: 'warehouse', id: 'south-shop' },
          evidence: {
            note: 'transfer note',
            photo: { file_name: 'proof.jpg', src: 'data:image/jpeg;base64,cHJvb2Y=' },
          },
        },
        response: { handoff_id: 'HO-9', tool_unit_id: 'TL-101', event_id: 'EV-9', status: 'pending' },
        invoke: (client: ReturnType<typeof createHttpApi>) =>
          client.custody.startTransfer({
            toolUnitId: 'TL-101',
            actorId: 'ray-torres',
            to: { type: 'warehouse', warehouseId: 'south-shop' },
            evidence: {
              note: ' transfer note ',
              photo: { fileName: 'proof.jpg', src: 'data:image/jpeg;base64,cHJvb2Y=' },
            },
          }),
      },
      {
        path: '/api/tools/handoffs/HO-9/accept',
        body: { actor_id: 'jordan-lee', tool_unit_id: 'TL-101', evidence: { note: 'accept note' } },
        response: { handoff_id: 'HO-9', tool_unit_id: 'TL-101', event_id: 'EV-9', status: 'accepted' },
        invoke: (client: ReturnType<typeof createHttpApi>) =>
          client.custody.acceptTransfer({
            handoffId: 'HO-9',
            toolUnitId: 'TL-101',
            actorId: 'jordan-lee',
            evidence: { note: ' accept note ' },
          }),
      },
      {
        path: '/api/tools/handoffs/HO-9/decline',
        body: {
          actor_id: 'jordan-lee',
          tool_unit_id: 'TL-101',
          evidence: { photo: { file_name: 'proof.jpg', src: 'data:image/jpeg;base64,cHJvb2Y=' } },
        },
        response: { handoff_id: 'HO-9', tool_unit_id: 'TL-101', event_id: 'EV-9', status: 'declined' },
        invoke: (client: ReturnType<typeof createHttpApi>) =>
          client.custody.declineTransfer({
            handoffId: 'HO-9',
            toolUnitId: 'TL-101',
            actorId: 'jordan-lee',
            evidence: { photo: { fileName: 'proof.jpg', src: 'data:image/jpeg;base64,cHJvb2Y=' } },
          }),
      },
      {
        path: '/api/tools/handoffs/HO-9/cancel',
        body: { actor_id: 'ray-torres', tool_unit_id: 'TL-101' },
        response: { handoff_id: 'HO-9', tool_unit_id: 'TL-101', event_id: 'EV-9', status: 'cancelled' },
        invoke: (client: ReturnType<typeof createHttpApi>) =>
          client.custody.cancelTransfer({ handoffId: 'HO-9', toolUnitId: 'TL-101', actorId: 'ray-torres' }),
      },
      {
        path: '/api/tools/handoffs/HO-9/withdraw',
        body: { actor_id: 'ray-torres', tool_unit_id: 'TL-101' },
        response: { handoff_id: 'HO-9', tool_unit_id: 'TL-101', event_id: 'EV-9', status: 'withdrawn' },
        invoke: (client: ReturnType<typeof createHttpApi>) =>
          client.custody.withdrawRequest({ handoffId: 'HO-9', toolUnitId: 'TL-101', actorId: 'ray-torres' }),
      },
      {
        path: '/api/tools/TL-101/condition',
        body: { actor_id: 'ray-torres', condition: 'damaged', evidence: { note: 'condition note' } },
        response: { tool_unit_id: 'TL-101', event_id: 'EV-9', status: 'reported' },
        invoke: (client: ReturnType<typeof createHttpApi>) =>
          client.custody.reportToolCondition({
            toolUnitId: 'TL-101',
            actorId: 'ray-torres',
            condition: 'damaged',
            evidence: { note: ' condition note ' },
          }),
      },
    ] as const;
    for (const operation of operations) {
      const calls: Array<{ path: string; body: unknown }> = [];
      const client = createHttpApi({
        transport: {
          get: async <T>() => [] as T,
          post: async <T>(path: string, body: unknown) => {
            calls.push({ path, body });
            return operation.response as T;
          },
        },
      });
      await expect(operation.invoke(client)).resolves.toMatchObject({ toolUnitId: 'TL-101', eventId: 'EV-9' });
      expect(calls).toEqual([{ path: operation.path, body: operation.body }]);
    }
  });

  it('fails closed on mismatched command receipts and duplicate targets', async () => {
    const api = createHttpApi({
      transport: {
        get: async <T>() =>
          [
            { kind: 'warehouse', id: 'south-shop', label: 'South Shop' },
            { kind: 'warehouse', id: 'south-shop', label: 'South Shop again' },
          ] as T,
        post: async <T>() => ({ ...mutation, tool_unit_id: 'TL-other' }) as T,
      },
    });
    await expect(api.custody.requestTool({ toolUnitId: 'TL-101', actorId: 'ray-torres' })).rejects.toThrow(
      'correlation',
    );
    await expect(api.custody.listTransferTargets({ actorId: 'ray-torres', toolUnitId: 'TL-101' })).rejects.toThrow(
      'transfer target ids',
    );
  });

  it('requires operation-specific receipt status and handoff correlation', async () => {
    const responses = new Map<string, unknown>([
      ['/api/tools/TL-101/request', { tool_unit_id: 'TL-101', event_id: 'EV-9', status: 'pending' }],
      [
        '/api/tools/TL-101/transfer',
        { handoff_id: 'HO-9', tool_unit_id: 'TL-101', event_id: 'EV-9', status: 'accepted' },
      ],
      [
        '/api/tools/handoffs/HO-9/accept',
        { handoff_id: 'HO-9', tool_unit_id: 'TL-101', event_id: 'EV-9', status: 'pending' },
      ],
    ]);
    const api = createHttpApi({
      transport: {
        get: async <T>() => [] as T,
        post: async <T>(path: string) => responses.get(path) as T,
      },
    });
    await expect(api.custody.requestTool({ toolUnitId: 'TL-101', actorId: 'ray-torres' })).rejects.toThrow(
      'mutation handoff id',
    );
    await expect(
      api.custody.startTransfer({
        toolUnitId: 'TL-101',
        actorId: 'ray-torres',
        to: { type: 'warehouse', warehouseId: 'south-shop' },
      }),
    ).rejects.toThrow('mutation status for start-transfer');
    await expect(
      api.custody.acceptTransfer({ handoffId: 'HO-9', toolUnitId: 'TL-101', actorId: 'jordan-lee' }),
    ).rejects.toThrow('mutation status for accept');

    const terminalOperations = [
      {
        path: '/api/tools/handoffs/HO-9/decline',
        invoke: (client: ReturnType<typeof createHttpApi>) =>
          client.custody.declineTransfer({ handoffId: 'HO-9', toolUnitId: 'TL-101', actorId: 'jordan-lee' }),
        response: { handoff_id: 'HO-9', tool_unit_id: 'TL-101', event_id: 'EV-9', status: 'pending' },
        message: 'mutation status for decline',
      },
      {
        path: '/api/tools/handoffs/HO-9/cancel',
        invoke: (client: ReturnType<typeof createHttpApi>) =>
          client.custody.cancelTransfer({ handoffId: 'HO-9', toolUnitId: 'TL-101', actorId: 'ray-torres' }),
        response: { handoff_id: 'HO-9', tool_unit_id: 'TL-101', event_id: 'EV-9', status: 'accepted' },
        message: 'mutation status for cancel',
      },
      {
        path: '/api/tools/handoffs/HO-9/withdraw',
        invoke: (client: ReturnType<typeof createHttpApi>) =>
          client.custody.withdrawRequest({ handoffId: 'HO-9', toolUnitId: 'TL-101', actorId: 'ray-torres' }),
        response: { tool_unit_id: 'TL-101', event_id: 'EV-9', status: 'withdrawn' },
        message: 'mutation handoff id',
      },
      {
        path: '/api/tools/TL-101/condition',
        invoke: (client: ReturnType<typeof createHttpApi>) =>
          client.custody.reportToolCondition({ toolUnitId: 'TL-101', actorId: 'ray-torres', condition: 'damaged' }),
        response: { handoff_id: 'HO-9', tool_unit_id: 'TL-101', event_id: 'EV-9', status: 'reported' },
        message: 'unexpected mutation handoff id',
      },
    ] as const;
    for (const operation of terminalOperations) {
      const client = createHttpApi({
        transport: {
          get: async <T>() => [] as T,
          post: async <T>(path: string) => {
            expect(path).toBe(operation.path);
            return operation.response as T;
          },
        },
      });
      await expect(operation.invoke(client)).rejects.toThrow(operation.message);
    }

    const mismatched = createHttpApi({
      transport: {
        get: async <T>() => [] as T,
        post: async <T>() =>
          ({ handoff_id: 'HO-9', tool_unit_id: 'TL-other', event_id: 'EV-9', status: 'declined' }) as T,
      },
    });
    await expect(
      mismatched.custody.declineTransfer({ handoffId: 'HO-9', toolUnitId: 'TL-101', actorId: 'jordan-lee' }),
    ).rejects.toThrow('mutation tool id correlation');

    const wrongHandoffOperations = [
      {
        invoke: (client: ReturnType<typeof createHttpApi>) =>
          client.custody.acceptTransfer({ handoffId: 'HO-9', toolUnitId: 'TL-101', actorId: 'jordan-lee' }),
        status: 'accepted' as const,
      },
      {
        invoke: (client: ReturnType<typeof createHttpApi>) =>
          client.custody.cancelTransfer({ handoffId: 'HO-9', toolUnitId: 'TL-101', actorId: 'ray-torres' }),
        status: 'cancelled' as const,
      },
      {
        invoke: (client: ReturnType<typeof createHttpApi>) =>
          client.custody.withdrawRequest({ handoffId: 'HO-9', toolUnitId: 'TL-101', actorId: 'ray-torres' }),
        status: 'withdrawn' as const,
      },
    ];
    for (const operation of wrongHandoffOperations) {
      const client = createHttpApi({
        transport: {
          get: async <T>() => [] as T,
          post: async <T>() =>
            ({ handoff_id: 'HO-other', tool_unit_id: 'TL-101', event_id: 'EV-9', status: operation.status }) as T,
        },
      });
      await expect(operation.invoke(client)).rejects.toThrow('mutation handoff correlation');
    }
  });

  it('rejects malformed mutation receipt identity and status fields', async () => {
    const malformedReceipts: unknown[] = [
      { ...mutation, event_id: '' },
      { ...mutation, event_id: '   ' },
      { ...mutation, event_id: 42 },
      { ...mutation, event_id: undefined },
      { ...mutation, handoff_id: '' },
      { ...mutation, handoff_id: '   ' },
      { ...mutation, handoff_id: 42 },
      { ...mutation, handoff_id: undefined },
      { ...mutation, tool_unit_id: '' },
      { ...mutation, status: 'unknown' },
    ];
    for (const response of malformedReceipts) {
      const api = createHttpApi({
        transport: {
          get: async <T>() => [] as T,
          post: async <T>() => response as T,
        },
      });
      await expect(api.custody.requestTool({ toolUnitId: 'TL-101', actorId: 'ray-torres' })).rejects.toThrow(
        'Invalid API response',
      );
    }
  });
});
