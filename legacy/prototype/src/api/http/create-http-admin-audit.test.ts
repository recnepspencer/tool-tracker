import { describe, expect, it } from 'vitest';
import { createHttpAdminApi } from './create-http-admin-api';

const event = {
  event_id: 'EV-1',
  actor_id: 'sam-ochoa',
  actor_name: 'Sam Ochoa',
  action: 'Added a tool',
  tool_unit_id: 'TL-108',
  tool_name: 'Bandsaw',
  occurred_at: '2026-08-17T10:18:00-06:00',
  kind: 'admin' as const,
  scope: 'admin' as const,
  warehouse_id: 'north-yard',
  warehouse_name: 'North Yard',
};

const apiFor = (payload: unknown, paths: string[]) =>
  createHttpAdminApi({
    transport: {
      get: async <T>(path: string) => {
        paths.push(path);
        return payload as T;
      },
      post: async <T>() => ({}) as T,
    },
  });

describe('HTTP admin audit adapter', () => {
  it('maps wrapped and bare audit responses, preserves tool identity, and sorts by instant', async () => {
    const paths: string[] = [];
    const older = {
      ...event,
      event_id: 'EV-0',
      action: 'Reviewed inventory',
      tool_unit_id: undefined,
      tool_name: undefined,
      occurred_at: '2026-08-17T15:12:00Z',
      warehouse_id: undefined,
      warehouse_name: undefined,
    };
    const api = apiFor({ events: [older, event] }, paths);
    const events = await api.listAuditLog({ actorId: 'sam-ochoa' });
    expect(paths).toEqual(['/api/admin/activity?actor_id=sam-ochoa']);
    expect(events.map((item) => item.id)).toEqual(['EV-1', 'EV-0']);
    expect(events[0]).toMatchObject({ toolUnitId: 'TL-108', toolName: 'Bandsaw', time: 'Aug 17, 2026, 10:18 AM' });

    const bare = apiFor([event], []);
    await expect(bare.listAuditLog({ actorId: 'sam-ochoa' })).resolves.toHaveLength(1);
  });

  it('rejects duplicate IDs and malformed event references at the HTTP boundary', async () => {
    await expect(
      apiFor({ events: [event, { ...event, action: 'Duplicate id' }] }, []).listAuditLog({ actorId: 'sam-ochoa' }),
    ).rejects.toThrow('admin audit');
    await expect(
      apiFor({ events: [{ ...event, event_id: ' ' }] }, []).listAuditLog({ actorId: 'sam-ochoa' }),
    ).rejects.toThrow('event id');
    await expect(
      apiFor({ events: [{ ...event, tool_unit_id: undefined }] }, []).listAuditLog({ actorId: 'sam-ochoa' }),
    ).rejects.toThrow('event tool reference');
    await expect(
      apiFor(
        { events: [{ ...event, tool_unit_id: undefined, tool_name: undefined, scope: 'worker' as const }] },
        [],
      ).listAuditLog({
        actorId: 'sam-ochoa',
      }),
    ).rejects.toThrow('event tool reference');
  });
});
