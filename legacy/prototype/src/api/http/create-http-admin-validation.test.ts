import { describe, expect, it } from 'vitest';
import { apiFor, validSummary, validSummaryEvent, validWarehouse } from './http-validation-fixtures';

describe('createHttpApi admin validation', () => {
  it('rejects incoherent counts, coverage, and warehouse collections', async () => {
    await expect(
      apiFor('/api/admin/summary?actor_id=sam-ochoa', {
        ...validSummary,
        pending_approvals: undefined,
      }).admin.getSummary(),
    ).rejects.toThrow('summary pending approvals');
    await expect(
      apiFor('/api/admin/summary?actor_id=sam-ochoa', {
        ...validSummary,
        long_held_tools: undefined,
      }).admin.getSummary(),
    ).rejects.toThrow('summary long-held tools');
    await expect(
      apiFor('/api/admin/summary?actor_id=sam-ochoa', { ...validSummary, total_tools: -1 }).admin.getSummary(),
    ).rejects.toThrow('summary total');
    await expect(
      apiFor('/api/admin/summary?actor_id=sam-ochoa', { ...validSummary, checked_out: 0.5 }).admin.getSummary(),
    ).rejects.toThrow('summary checked out');
    await expect(
      apiFor('/api/admin/summary?actor_id=sam-ochoa', { ...validSummary, checked_out: 7 }).admin.getSummary(),
    ).rejects.toThrow('summary aggregate counts');
    await expect(
      apiFor('/api/admin/summary?actor_id=sam-ochoa', { ...validSummary, flagged: 1 }).admin.getSummary(),
    ).rejects.toThrow('summary aggregate counts');
    await expect(
      apiFor('/api/admin/summary?actor_id=sam-ochoa', { ...validSummary, in_stock: 0 }).admin.getSummary(),
    ).rejects.toThrow('summary aggregate counts');
    await expect(
      apiFor('/api/admin/summary?actor_id=sam-ochoa', {
        ...validSummary,
        warehouses: [{ ...validWarehouse, stock_count: 0 }],
      }).admin.getSummary(),
    ).rejects.toThrow('summary warehouse coverage');
    await expect(
      apiFor('/api/admin/summary?actor_id=sam-ochoa', {
        ...validSummary,
        total_tools: 2,
        in_stock: 2,
        warehouses: [{ ...validWarehouse, stock_count: 1 }],
      }).admin.getSummary(),
    ).rejects.toThrow('summary warehouse coverage');
    await expect(
      apiFor('/api/admin/summary?actor_id=sam-ochoa', {
        ...validSummary,
        warehouses: 'not-an-array',
      }).admin.getSummary(),
    ).rejects.toThrow('summary warehouses');
    await expect(
      apiFor('/api/admin/summary?actor_id=sam-ochoa', {
        ...validSummary,
        warehouses: [validWarehouse, { ...validWarehouse, name: 'Duplicate North Yard' }],
      }).admin.getSummary(),
    ).rejects.toThrow('warehouse ids');
    const holderSinceAt = '2026-08-10T09:00:00-06:00';
    await expect(
      apiFor('/api/admin/summary?actor_id=sam-ochoa', {
        ...validSummary,
        checked_out: 1,
        in_stock: 0,
        warehouses: [{ ...validWarehouse, stock_count: 0, out_count: 1 }],
        long_held_tools: [
          {
            tool_unit_id: 'TL-101',
            tool_name: 'Hammer drill',
            holder_since_at: holderSinceAt,
            holder_since: 'Aug 10, 2026, 9:00 AM',
            warehouse_id: 'south-shop',
            warehouse_name: 'South Shop',
            status: 'checked-out',
          },
        ],
      }).admin.getSummary(),
    ).rejects.toThrow('held tool warehouse reference');
  });

  it('rejects malformed, duplicate, and unreferenced recent events', async () => {
    await expect(
      apiFor('/api/admin/summary?actor_id=sam-ochoa', {
        ...validSummary,
        recent_events: [
          {
            event_id: 'EV-invalid',
            actor_id: 'sam-ochoa',
            actor_name: 'Sam Ochoa',
            action: 'Invalid event',
            occurred_at: 'not-an-instant',
            kind: 'admin',
          },
        ],
      }).admin.getSummary(),
    ).rejects.toThrow('event time');
    await expect(
      apiFor('/api/admin/summary?actor_id=sam-ochoa', {
        ...validSummary,
        recent_events: [validSummaryEvent, { ...validSummaryEvent, action: 'Duplicate event' }],
      }).admin.getSummary(),
    ).rejects.toThrow('event ids');
    await expect(
      apiFor('/api/admin/summary?actor_id=sam-ochoa', {
        ...validSummary,
        recent_events: [{ ...validSummaryEvent, tool_name: 'Invented tool' }],
      }).admin.getSummary(),
    ).rejects.toThrow('event tool reference');
    await expect(
      apiFor('/api/admin/summary?actor_id=sam-ochoa', {
        ...validSummary,
        recent_events: [{ ...validSummaryEvent, tool_unit_id: 'TL-101' }],
      }).admin.getSummary(),
    ).rejects.toThrow('event tool reference');
    await expect(
      apiFor('/api/admin/summary?actor_id=sam-ochoa', {
        ...validSummary,
        recent_events: [{ ...validSummaryEvent, kind: 'custody' }],
      }).admin.getSummary(),
    ).rejects.toThrow('event tool reference');
  });

  it('preserves normalized audit evidence through admin event mapping', async () => {
    const summary = await apiFor('/api/admin/summary?actor_id=sam-ochoa', {
      ...validSummary,
      recent_events: [{ ...validSummaryEvent, evidence: { note: '  Removal context  ' } }],
    }).admin.getSummary();
    expect(summary.recentEvents[0]).toMatchObject({ evidence: { note: 'Removal context' } });
  });

  it('sorts HTTP long-held tools by canonical instant and stable unit ID', async () => {
    const held = (toolUnitId: string, toolName: string, holderSinceAt: string, holderSince: string) => ({
      tool_unit_id: toolUnitId,
      tool_name: toolName,
      holder_since_at: holderSinceAt,
      holder_since: holderSince,
      warehouse_id: 'north-yard',
      warehouse_name: 'North Yard',
      status: 'checked-out' as const,
    });
    const summary = await apiFor('/api/admin/summary?actor_id=sam-ochoa', {
      ...validSummary,
      total_tools: 3,
      checked_out: 3,
      in_stock: 0,
      tools: [
        { tool_unit_id: 'TL-101', name: 'Hammer drill' },
        { tool_unit_id: 'TL-102', name: 'Bandsaw' },
        { tool_unit_id: 'TL-103', name: 'Rotary hammer' },
      ],
      warehouses: [{ ...validWarehouse, stock_count: 0, out_count: 3 }],
      long_held_tools: [
        held('TL-101', 'Hammer drill', '2026-08-12T09:00:00-06:00', 'Aug 12, 2026, 9:00 AM'),
        held('TL-103', 'Rotary hammer', '2026-08-11T09:00:00-06:00', 'Aug 11, 2026, 9:00 AM'),
        held('TL-102', 'Bandsaw', '2026-08-11T09:00:00-06:00', 'Aug 11, 2026, 9:00 AM'),
      ],
    }).admin.getSummary();
    expect(summary.longHeldTools.map((tool) => tool.toolUnitId)).toEqual(['TL-102', 'TL-103', 'TL-101']);
  });

  it('preserves and validates canonical event actor and warehouse references', async () => {
    const summary = await apiFor('/api/admin/summary?actor_id=sam-ochoa', {
      ...validSummary,
      recent_events: [
        {
          ...validSummaryEvent,
          warehouse_id: 'north-yard',
          warehouse_name: 'North Yard',
        },
      ],
    }).admin.getSummary();
    expect(summary.recentEvents[0]).toMatchObject({
      actorId: 'sam-ochoa',
      warehouseId: 'north-yard',
      warehouseName: 'North Yard',
    });
    await expect(
      apiFor('/api/admin/summary?actor_id=sam-ochoa', {
        ...validSummary,
        recent_events: [{ ...validSummaryEvent, actor_id: '  ' }],
      }).admin.getSummary(),
    ).rejects.toThrow('event actor id');
    await expect(
      apiFor('/api/admin/summary?actor_id=sam-ochoa', {
        ...validSummary,
        recent_events: [{ ...validSummaryEvent, warehouse_id: 'north-yard' }],
      }).admin.getSummary(),
    ).rejects.toThrow('event warehouse reference');
    await expect(
      apiFor('/api/admin/summary?actor_id=sam-ochoa', {
        ...validSummary,
        recent_events: [{ ...validSummaryEvent, warehouse_id: 'south-shop', warehouse_name: 'South Shop' }],
      }).admin.getSummary(),
    ).rejects.toThrow('event warehouse reference');
    await expect(
      apiFor('/api/admin/summary?actor_id=sam-ochoa', {
        ...validSummary,
        recent_events: [{ ...validSummaryEvent, actor_id: 'unknown-person' }],
      }).admin.getSummary(),
    ).rejects.toThrow('event actor reference');
    await expect(
      apiFor('/api/admin/summary?actor_id=sam-ochoa', {
        ...validSummary,
        recent_events: [{ ...validSummaryEvent, tool_unit_id: 'TL-999', tool_name: 'Invented tool' }],
      }).admin.getSummary(),
    ).rejects.toThrow('event tool reference');
    await expect(
      apiFor('/api/admin/summary?actor_id=sam-ochoa', {
        ...validSummary,
        people: [...validSummary.people, ...validSummary.people],
      }).admin.getSummary(),
    ).rejects.toThrow('duplicate admin person reference');
    await expect(
      apiFor('/api/admin/summary?actor_id=sam-ochoa', {
        ...validSummary,
        tools: [...validSummary.tools, ...validSummary.tools],
      }).admin.getSummary(),
    ).rejects.toThrow('duplicate admin tool reference');
    await expect(
      apiFor('/api/admin/summary?actor_id=sam-ochoa', {
        ...validSummary,
        warehouses: [{ ...validWarehouse, manager_id: 'unknown-person' }],
      }).admin.getSummary(),
    ).rejects.toThrow('summary warehouse manager reference');
    await expect(
      apiFor('/api/admin/summary?actor_id=sam-ochoa', {
        ...validSummary,
        warehouses: [{ ...validWarehouse, manager_name: 'Wrong name' }],
      }).admin.getSummary(),
    ).rejects.toThrow('summary warehouse manager reference');
    await expect(
      apiFor('/api/admin/summary?actor_id=sam-ochoa', {
        ...validSummary,
        people: [{ ...validSummary.people[0], lifecycle: 'suspended' }],
      }).admin.getSummary(),
    ).rejects.toThrow('summary warehouse manager');
  });
});
