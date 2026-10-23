import { describe, expect, it } from 'vitest';
import type { HandoffReviewInput } from '../contracts/custody-api';
import { createMockApi } from './create-mock-api';
import { createMockDatabase } from './mock-database';

const scenarios = [
  {
    name: 'decline',
    actorId: 'jordan-lee',
    handoff: {
      id: 'HO-10',
      kind: 'transfer' as const,
      toolUnitId: 'TL-101',
      from: { type: 'worker' as const, userId: 'ray-torres' },
      to: { type: 'worker' as const, userId: 'jordan-lee' },
      requestedBy: 'ray-torres',
      requestedAt: '2026-08-18T11:00:00Z',
      status: 'pending' as const,
    },
    resolve: (api: ReturnType<typeof createMockApi>, input: HandoffReviewInput) => api.custody.declineTransfer(input),
  },
  {
    name: 'cancel',
    actorId: 'avery-cole',
    handoff: {
      id: 'HO-11',
      kind: 'transfer' as const,
      toolUnitId: 'TL-115',
      from: { type: 'worker' as const, userId: 'avery-cole' },
      to: { type: 'warehouse' as const, warehouseId: 'south-shop' },
      requestedBy: 'avery-cole',
      requestedAt: '2026-08-18T11:00:00Z',
      status: 'pending' as const,
    },
    resolve: (api: ReturnType<typeof createMockApi>, input: HandoffReviewInput) => api.custody.cancelTransfer(input),
  },
  {
    name: 'withdraw',
    actorId: 'avery-cole',
    handoff: {
      id: 'HO-12',
      kind: 'warehouse-request' as const,
      toolUnitId: 'TL-105',
      from: { type: 'warehouse' as const, warehouseId: 'north-yard' },
      to: { type: 'worker' as const, userId: 'avery-cole' },
      requestedBy: 'avery-cole',
      requestedAt: '2026-08-18T11:00:00Z',
      status: 'pending' as const,
    },
    resolve: (api: ReturnType<typeof createMockApi>, input: HandoffReviewInput) => api.custody.withdrawRequest(input),
  },
] as const;

const inactiveLifecycles = ['invited', 'suspended', 'removed'] as const;
const inactiveScenarios = scenarios.flatMap((scenario) =>
  inactiveLifecycles.map((lifecycle) => ({ scenario, lifecycle })),
);

describe('inactive custody resolution authority', () => {
  it.each(inactiveScenarios)(
    'rejects an inactive worker decision and hides pending actions (%#)',
    async ({ scenario, lifecycle }) => {
      const database = createMockDatabase();
      database.update((state) => ({
        ...state,
        users: [
          ...state.users,
          {
            id: 'jordan-lee',
            name: 'Jordan Lee',
            email: 'jordan@nelsonelectric.com',
            role: 'worker' as const,
            lifecycle: 'active' as const,
            title: 'Apprentice electrician',
            homeWarehouseId: 'north-yard',
          },
        ].map((user) => (user.id === scenario.actorId ? { ...user, lifecycle } : user)),
        handoffs: [...state.handoffs, scenario.handoff],
        custody: state.custody.map((record) =>
          scenario.actorId === 'avery-cole' && record.toolUnitId === 'TL-115'
            ? { ...record, holder: { type: 'worker', userId: 'avery-cole' } }
            : record,
        ),
      }));
      const api = createMockApi(database);
      const before = database.read();
      await expect(api.custody.listPendingHandoffs(scenario.actorId)).resolves.toEqual([]);
      await expect(
        scenario.resolve(api, {
          handoffId: scenario.handoff.id,
          toolUnitId: scenario.handoff.toolUnitId,
          actorId: scenario.actorId,
        }),
      ).rejects.toThrow('actor must be active');
      expect(database.read()).toEqual(before);
    },
  );
});
