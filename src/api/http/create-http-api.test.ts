import { describe, expect, it, vi } from 'vitest';
import { createHttpApi, type HttpTransport } from './create-http-api';

const holderWorker = { kind: 'worker', id: 'ray-torres', label: 'Ray Torres' };
const holderWarehouse = { kind: 'warehouse', id: 'north-yard', label: 'North Yard' };
const activityDto = {
  event_id: 'EV-1',
  actor_id: 'sam-ochoa',
  actor_name: 'Sam Ochoa',
  action: 'Added a tool',
  tool_unit_id: 'TL-101',
  tool_name: 'Hammer drill',
  image_url: './tool-images/hammer-drill.png',
  occurred_at: '2026-08-17T15:00:00Z',
  kind: 'admin',
  scope: 'warehouse',
  participant_ids: [],
  warehouse_id: 'north-yard',
  warehouse_name: 'North Yard',
};

describe('createHttpApi', () => {
  it('maps auth, tools, and admin responses through the focused adapters', async () => {
    const get = vi.fn(async <T>(path: string) => {
      if (path === '/v1/demo-profiles') {
        return [
          {
            profile_id: 'ray-torres',
            display_name: 'Ray Torres',
            email_address: 'ray@nelsonelectric.com',
            role: 'worker',
            job_title: 'Journeyman electrician',
            home_warehouse_id: 'north-yard',
            home_warehouse: 'North Yard',
          },
        ] as T;
      }
      if (path === '/v1/tools') {
        return [
          {
            tool_id: 'TL-101',
            revision: 1,
            display_name: 'Hammer drill',
            manufacturer: 'DeWalt',
            model: 'DCD996',
            category: 'Power tools',
            image_url: './tool-images/hammer-drill.png',
            display_status: 'checked-out',
            holder: holderWorker,
            last_moved_at: '2026-08-12T10:00:00-06:00',
            serial_number: 'HD-101',
          },
        ] as T;
      }
      return {
        total_tools: 1,
        checked_out: 1,
        in_stock: 0,
        flagged: 0,
        people: [{ person_id: 'sam-ochoa', display_name: 'Sam Ochoa', role: 'admin', lifecycle: 'active' }],
        tools: [{ tool_unit_id: 'TL-101', name: 'Hammer drill' }],
        warehouses: [
          {
            warehouse_id: 'north-yard',
            name: 'North Yard',
            address: '1420 Kerr Ave',
            manager_id: 'sam-ochoa',
            manager_name: 'Sam Ochoa',
            stock_count: 0,
            out_count: 1,
          },
        ],
        recent_events: [],
        pending_approvals: 0,
        long_held_tools: [],
      } as T;
    });
    const post = vi.fn(async <T>(path: string) =>
      path === '/v1/sessions/restore'
        ? (null as T)
        : ({
            profile_id: 'ray-torres',
            display_name: 'Ray Torres',
            role: 'worker',
            email_address: 'ray@nelsonelectric.com',
            job_title: 'Journeyman electrician',
            home_warehouse_id: 'north-yard',
            home_warehouse: 'North Yard',
          } as T),
    );
    const api = createHttpApi({
      transport: { get: get as HttpTransport['get'], post: post as HttpTransport['post'] },
      basePath: '/v1/',
    });
    await expect(api.auth.listDemoProfiles()).resolves.toEqual([
      {
        id: 'ray-torres',
        name: 'Ray Torres',
        email: 'ray@nelsonelectric.com',
        role: 'worker',
        title: 'Journeyman electrician',
        homeWarehouseId: 'north-yard',
        homeWarehouse: 'North Yard',
      },
    ]);
    await expect(api.auth.signInAs('ray-torres')).resolves.toEqual({
      profileId: 'ray-torres',
      name: 'Ray Torres',
      role: 'worker',
      email: 'ray@nelsonelectric.com',
      title: 'Journeyman electrician',
      homeWarehouseId: 'north-yard',
      homeWarehouse: 'North Yard',
    });
    await expect(api.auth.restoreSession('missing')).resolves.toBeNull();
    await expect(api.tools.listTools()).resolves.toEqual([
      {
        id: 'TL-101',
        revision: 1,
        name: 'Hammer drill',
        brand: 'DeWalt',
        model: 'DCD996',
        category: 'Power tools',
        imageSrc: './tool-images/hammer-drill.png',
        status: 'checked-out',
        holder: { type: 'worker', userId: 'ray-torres', name: 'Ray Torres' },
        lastMoved: 'Aug 12, 2026, 10:00 AM',
        serial: 'HD-101',
        lastMovedAt: '2026-08-12T10:00:00-06:00',
      },
    ]);
    await expect(api.admin.getSummary({ actorId: 'sam-ochoa' })).resolves.toEqual({
      totalTools: 1,
      checkedOut: 1,
      inStock: 0,
      flagged: 0,
      warehouses: [
        {
          id: 'north-yard',
          name: 'North Yard',
          address: '1420 Kerr Ave',
          managerId: 'sam-ochoa',
          manager: 'Sam Ochoa',
          tools: 0,
          out: 1,
        },
      ],
      recentEvents: [],
      pendingApprovals: 0,
      longHeldTools: [],
    });
    await expect(api.auth.signOut()).resolves.toBeUndefined();
    expect(get).toHaveBeenNthCalledWith(1, '/v1/demo-profiles');
    expect(post).toHaveBeenNthCalledWith(1, '/v1/sessions/demo', { profile_id: 'ray-torres' });
    expect(post).toHaveBeenNthCalledWith(2, '/v1/sessions/restore', { profile_id: 'missing' });
    expect(post).toHaveBeenNthCalledWith(3, '/v1/sessions/signout', {});
    expect(post).toHaveBeenCalledTimes(3);
  });

  it('maps catalog, detail, pending handoff, and activity read models', async () => {
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
            units: [{ unit_id: 'TL-101', warehouse_id: 'north-yard', display_status: 'checked-out' }],
            total_count: 1,
            available_count: 0,
            checked_out_count: 1,
            damaged_count: 0,
            lost_count: 0,
            warehouses: [{ warehouse_id: 'north-yard', name: 'North Yard', unit_count: 1 }],
          },
        ] as T;
      }
      if (path === '/api/tools/TL-101') {
        return {
          tool: {
            tool_id: 'TL-101',
            revision: 1,
            display_name: 'Hammer drill',
            manufacturer: 'DeWalt',
            model: 'DCD996',
            category: 'Power tools',
            image_url: './tool-images/hammer-drill.png',
            display_status: 'checked-out',
            holder: holderWorker,
            last_moved_at: '2026-08-12T10:00:00-06:00',
          },
          origin_warehouse: { warehouse_id: 'north-yard', name: 'North Yard' },
          condition: 'serviceable',
          lifecycle: 'active',
          timeline: [activityDto],
        } as T;
      }
      if (path.startsWith('/api/tools/pending-handoffs')) {
        return [
          {
            handoff_id: 'HO-1',
            tool_unit_id: 'TL-101',
            tool_name: 'Hammer drill',
            image_url: './tool-images/hammer-drill.png',
            from: holderWarehouse,
            to: holderWorker,
            requested_by_id: 'ray-torres',
            requested_by: 'Ray Torres',
            requested_at: '2026-08-17T10:18:00-06:00',
            lifecycle: 'active',
          },
        ] as T;
      }
      return [activityDto] as T;
    });
    const api = createHttpApi({
      transport: { get: get as HttpTransport['get'], post: vi.fn() as HttpTransport['post'] },
    });
    await expect(api.tools.listCatalog()).resolves.toEqual([
      {
        id: 'def-drill',
        name: 'Hammer drill',
        brand: 'DeWalt',
        model: 'DCD996',
        category: 'Power tools',
        imageSrc: './tool-images/hammer-drill.png',
        unitIds: ['TL-101'],
        units: [{ id: 'TL-101', warehouseId: 'north-yard', status: 'checked-out' }],
        totalCount: 1,
        availableCount: 0,
        checkedOutCount: 1,
        damagedCount: 0,
        lostCount: 0,
        warehouses: [{ id: 'north-yard', name: 'North Yard', unitCount: 1 }],
      },
    ]);
    await expect(api.tools.getToolDetail('TL-101')).resolves.toEqual({
      tool: {
        id: 'TL-101',
        revision: 1,
        name: 'Hammer drill',
        brand: 'DeWalt',
        model: 'DCD996',
        category: 'Power tools',
        imageSrc: './tool-images/hammer-drill.png',
        status: 'checked-out',
        holder: { type: 'worker', userId: 'ray-torres', name: 'Ray Torres' },
        lastMoved: 'Aug 12, 2026, 10:00 AM',
        lastMovedAt: '2026-08-12T10:00:00-06:00',
        serial: undefined,
      },
      originWarehouse: { id: 'north-yard', name: 'North Yard' },
      condition: 'serviceable',
      lifecycle: 'active',
      timeline: [
        {
          id: 'EV-1',
          actorId: 'sam-ochoa',
          actor: 'Sam Ochoa',
          action: 'Added a tool',
          toolUnitId: 'TL-101',
          toolName: 'Hammer drill',
          imageSrc: './tool-images/hammer-drill.png',
          time: 'Aug 17, 2026, 9:00 AM',
          timestamp: '2026-08-17T15:00:00Z',
          kind: 'admin',
          scope: 'warehouse',
          participantIds: [],
          warehouseId: 'north-yard',
          warehouseName: 'North Yard',
        },
      ],
    });
    await expect(api.custody.listPendingHandoffs('ray-torres')).resolves.toEqual([
      {
        id: 'HO-1',
        kind: 'warehouse-request',
        toolUnitId: 'TL-101',
        toolName: 'Hammer drill',
        imageSrc: './tool-images/hammer-drill.png',
        from: { type: 'warehouse', warehouseId: 'north-yard', name: 'North Yard' },
        to: { type: 'worker', userId: 'ray-torres', name: 'Ray Torres' },
        requestedBy: 'Ray Torres',
        requestedById: 'ray-torres',
        requestedAt: 'Aug 17, 2026, 10:18 AM',
        requestedAtInstant: '2026-08-17T10:18:00-06:00',
        direction: 'outgoing',
        allowedActions: ['withdraw'],
      },
    ]);
    await expect(api.activity.listActivity()).resolves.toEqual([
      {
        id: 'EV-1',
        actorId: 'sam-ochoa',
        actor: 'Sam Ochoa',
        action: 'Added a tool',
        toolUnitId: 'TL-101',
        toolName: 'Hammer drill',
        imageSrc: './tool-images/hammer-drill.png',
        time: 'Aug 17, 2026, 9:00 AM',
        timestamp: '2026-08-17T15:00:00Z',
        kind: 'admin',
        scope: 'warehouse',
        participantIds: [],
        warehouseId: 'north-yard',
        warehouseName: 'North Yard',
      },
    ]);
    expect(get).toHaveBeenNthCalledWith(1, '/api/tools/catalog');
    expect(get).toHaveBeenNthCalledWith(2, '/api/tools/TL-101');
    expect(get).toHaveBeenNthCalledWith(3, '/api/tools/pending-handoffs?profile_id=ray-torres');
    expect(get).toHaveBeenNthCalledWith(4, '/api/activity');
  });
});
