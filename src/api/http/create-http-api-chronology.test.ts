import { describe, expect, it, vi } from 'vitest';
import { createHttpApi, type HttpTransport } from './create-http-api';

describe('createHttpApi chronology and integrity', () => {
  it('rejects incomplete read models and encodes unit paths before mapping', async () => {
    const get = vi.fn(async <T>(path: string) => {
      if (path === '/api/tools/catalog') {
        return [
          {
            definition_id: 'def-drill',
            display_name: 'Hammer drill',
            manufacturer: 'DeWalt',
            model: 'DCD996',
            category: 'Power tools',
            image_url: './tool-images/hammer-drill.png',
            unit_ids: ['TL-101'],
            total_count: 1,
            available_count: 1,
            checked_out_count: 0,
            damaged_count: 0,
            lost_count: 0,
            warehouses: [],
          },
        ] as T;
      }
      if (path === '/api/tools/TL%20101') {
        return {
          tool: {
            tool_id: 'TL 101',
            display_name: 'Hammer drill',
            manufacturer: 'DeWalt',
            model: 'DCD996',
            category: 'Power tools',
            image_url: './tool-images/hammer-drill.png',
            display_status: 'in-stock',
            holder: { kind: 'contractor', id: 'unknown', label: 'Unknown' },
            last_moved_at: '2026-08-17T15:00:00Z',
          },
          origin_warehouse: { warehouse_id: 'north-yard', name: 'North Yard' },
          condition: 'serviceable',
          lifecycle: 'active',
          timeline: [],
        } as T;
      }
      return [
        {
          event_id: 'EV-1',
          actor_id: 'ray-torres',
          actor_name: 'Ray Torres',
          action: 'Checked out a tool',
          tool_unit_id: 'TL-101',
          tool_name: 'Hammer drill',
          image_url: './tool-images/hammer-drill.png',
          occurred_at: '2026-08-17T15:00:00Z',
          kind: 'custody',
          warehouse_id: 'north-yard',
          warehouse_name: 'North Yard',
        },
      ] as T;
    });
    const api = createHttpApi({
      transport: { get: get as HttpTransport['get'], post: vi.fn() as HttpTransport['post'] },
    });
    await expect(api.tools.listCatalog()).rejects.toThrow('catalog units');
    await expect(api.tools.getToolDetail('TL 101')).rejects.toThrow('holder kind');
    await expect(api.activity.listActivity()).rejects.toThrow('activity scope');
    expect(get).toHaveBeenNthCalledWith(2, '/api/tools/TL%20101');
  });

  it('sorts HTTP activity and detail timelines by timestamp instants', async () => {
    const event = (id: string, occurredAt: string, staleDisplay?: string) => ({
      event_id: id,
      actor_id: 'sam-ochoa',
      actor_name: 'Sam Ochoa',
      action: 'Reviewed a tool',
      tool_unit_id: 'TL-101',
      tool_name: 'Hammer drill',
      image_url: './tool-images/hammer-drill.png',
      occurred_at: occurredAt,
      kind: 'admin',
      scope: 'warehouse',
      participant_ids: [],
      warehouse_id: 'north-yard',
      warehouse_name: 'North Yard',
      ...(staleDisplay ? { display_time: staleDisplay } : {}),
    });
    const detail = {
      tool: {
        tool_id: 'TL-101',
        revision: 1,
        display_name: 'Hammer drill',
        manufacturer: 'DeWalt',
        model: 'DCD996',
        category: 'Power tools',
        image_url: './tool-images/hammer-drill.png',
        display_status: 'in-stock',
        holder: { kind: 'warehouse', id: 'north-yard', label: 'North Yard' },
        last_moved_at: '2026-08-17T15:00:00Z',
      },
      origin_warehouse: { warehouse_id: 'north-yard', name: 'North Yard' },
      condition: 'serviceable',
      lifecycle: 'active',
      timeline: [event('EV-early', '2026-08-17T09:00:00-06:00'), event('EV-late', '2026-08-17T16:30:00Z', 'Yesterday')],
    };
    const get = vi.fn(
      async <T>(path: string) =>
        (path === '/api/activity'
          ? [event('EV-early', '2026-08-17T09:00:00-06:00'), event('EV-late', '2026-08-17T16:30:00Z', 'Yesterday')]
          : detail) as T,
    );
    const api = createHttpApi({
      transport: { get: get as HttpTransport['get'], post: vi.fn() as HttpTransport['post'] },
    });
    await expect(api.activity.listActivity()).resolves.toMatchObject([{ id: 'EV-late' }, { id: 'EV-early' }]);
    expect((await api.activity.listActivity())[0].time).toBe('Aug 17, 2026, 10:30 AM');
    await expect(api.tools.getToolDetail('TL-101')).resolves.toMatchObject({
      timeline: [{ id: 'EV-late' }, { id: 'EV-early' }],
    });
  });

  it('maps a general audit event without manufacturing a tool reference', async () => {
    const get = vi.fn(
      async <T>() =>
        ({
          total_tools: 0,
          checked_out: 0,
          in_stock: 0,
          flagged: 0,
          people: [{ person_id: 'sam-ochoa', display_name: 'Sam Ochoa', role: 'admin', lifecycle: 'active' }],
          tools: [],
          warehouses: [],
          recent_events: [
            {
              event_id: 'EV-admin-old',
              actor_id: 'sam-ochoa',
              actor_name: 'Sam Ochoa',
              action: 'Updated warehouse settings',
              occurred_at: '2026-08-16T15:00:00Z',
              kind: 'admin',
            },
            {
              event_id: 'EV-admin-new',
              actor_id: 'sam-ochoa',
              actor_name: 'Sam Ochoa',
              action: 'Updated warehouse settings again',
              occurred_at: '2026-08-17T15:00:00Z',
              kind: 'admin',
            },
          ],
          pending_approvals: 0,
          long_held_tools: [],
        }) as T,
    );
    const api = createHttpApi({
      transport: { get: get as HttpTransport['get'], post: vi.fn() as HttpTransport['post'] },
    });
    await expect(api.admin.getSummary({ actorId: 'sam-ochoa' })).resolves.toMatchObject({
      recentEvents: [
        { id: 'EV-admin-new', action: 'Updated warehouse settings again', timestamp: '2026-08-17T15:00:00Z' },
        { id: 'EV-admin-old', action: 'Updated warehouse settings', timestamp: '2026-08-16T15:00:00Z' },
      ],
    });
    const summary = await api.admin.getSummary({ actorId: 'sam-ochoa' });
    expect(summary.recentEvents[0].toolName).toBeUndefined();
  });

  it('preserves archived detail lifecycle consistently with the mock adapter', async () => {
    const get = vi.fn(
      async <T>() =>
        ({
          tool: {
            tool_id: 'TL-101',
            revision: 1,
            display_name: 'Hammer drill',
            manufacturer: 'DeWalt',
            model: 'DCD996',
            category: 'Power tools',
            image_url: './tool-images/hammer-drill.png',
            display_status: 'checked-out',
            holder: { kind: 'worker', id: 'ray-torres', label: 'Ray Torres' },
            last_moved_at: '2026-08-12T10:00:00-06:00',
          },
          origin_warehouse: { warehouse_id: 'north-yard', name: 'North Yard' },
          condition: 'serviceable',
          lifecycle: 'archived',
          timeline: [],
        }) as T,
    );
    const api = createHttpApi({
      transport: { get: get as HttpTransport['get'], post: vi.fn() as HttpTransport['post'] },
    });
    await expect(api.tools.getToolDetail('TL-101')).resolves.toMatchObject({ lifecycle: 'archived' });
  });
});
