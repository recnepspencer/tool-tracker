import { describe, expect, it } from 'vitest';
import { apiFor } from './http-validation-fixtures';

const warehouseReference = { warehouse_id: 'north-yard', name: 'North Yard' };
const peopleReferences = [{ person_id: 'sam-ochoa', display_name: 'Sam Ochoa', role: 'admin', lifecycle: 'active' }];
const toolReferences = [{ tool_unit_id: 'TL-101', name: 'Hammer drill' }];

describe('HTTP admin custody boundaries', () => {
  it('rejects a person detail response for a different requested identity', async () => {
    await expect(
      apiFor('/api/admin/people/avery-cole?actor_id=sam-ochoa', {
        person_id: 'casey-reed',
        display_name: 'Casey Reed',
        email_address: 'casey@nelsonelectric.com',
        job_title: 'Field electrician',
        role: 'worker',
        lifecycle: 'invited',
        home_warehouse_id: 'north-yard',
        home_warehouse: 'North Yard',
        can_authenticate: false,
        held_tool_count: 0,
        pending_handoff_count: 0,
        held_tools: [],
        recent_events: [],
        warehouses: [warehouseReference],
        people: peopleReferences,
        tools: toolReferences,
      }).admin.getPerson!({ actorId: 'sam-ochoa', personId: 'avery-cole' }),
    ).rejects.toThrow('person detail reference');
  });

  it('maps non-empty custody receipts and canonical held-tool instants', async () => {
    const holderSinceAt = '2026-08-10T09:00:00-06:00';
    const holderSince = 'Aug 10, 2026, 9:00 AM';
    const heldTool = {
      tool_unit_id: 'TL-101',
      tool_name: 'Hammer drill',
      holder_since_at: holderSinceAt,
      holder_since: holderSince,
      warehouse_id: 'north-yard',
      warehouse_name: 'North Yard',
      status: 'checked-out' as const,
    };
    const detail = await apiFor('/api/admin/people/avery-cole?actor_id=sam-ochoa', {
      person_id: 'avery-cole',
      display_name: 'Avery Cole',
      email_address: 'avery@nelsonelectric.com',
      job_title: 'Apprentice electrician',
      role: 'worker',
      lifecycle: 'active',
      home_warehouse_id: 'north-yard',
      home_warehouse: 'North Yard',
      can_authenticate: true,
      held_tool_count: 1,
      pending_handoff_count: 0,
      held_tools: [heldTool],
      recent_events: [],
      warehouses: [warehouseReference],
      people: peopleReferences,
      tools: toolReferences,
    }).admin.getPerson!({ actorId: 'sam-ochoa', personId: 'avery-cole' });
    expect(detail.heldTools).toEqual([
      expect.objectContaining({
        toolUnitId: 'TL-101',
        holderSinceAt,
        holderSince,
      }),
    ]);

    for (const invalidTool of [
      { tool_unit_id: 'TL-999', tool_name: 'Hammer drill' },
      { tool_unit_id: 'TL-101', tool_name: 'Invented tool' },
    ]) {
      await expect(
        apiFor('/api/admin/people/avery-cole?actor_id=sam-ochoa', {
          person_id: 'avery-cole',
          display_name: 'Avery Cole',
          email_address: 'avery@nelsonelectric.com',
          job_title: 'Apprentice electrician',
          role: 'worker',
          lifecycle: 'active',
          home_warehouse_id: 'north-yard',
          home_warehouse: 'North Yard',
          can_authenticate: true,
          held_tool_count: 1,
          pending_handoff_count: 0,
          held_tools: [{ ...heldTool, ...invalidTool }],
          recent_events: [],
          warehouses: [warehouseReference],
          people: peopleReferences,
          tools: toolReferences,
        }).admin.getPerson!({ actorId: 'sam-ochoa', personId: 'avery-cole' }),
      ).rejects.toThrow('held tool reference');
    }

    const detailEvent = {
      event_id: 'EV-detail',
      actor_id: 'sam-ochoa',
      actor_name: 'Sam Ochoa',
      action: 'Reviewed custody',
      tool_unit_id: 'TL-101',
      tool_name: 'Hammer drill',
      occurred_at: '2026-08-17T15:00:00Z',
      kind: 'admin' as const,
      warehouse_id: 'north-yard',
      warehouse_name: 'North Yard',
    };
    for (const invalidEvent of [
      { ...detailEvent, actor_id: 'unknown-person' },
      { ...detailEvent, actor_name: 'Wrong name' },
      { ...detailEvent, tool_unit_id: 'TL-999' },
      { ...detailEvent, tool_name: 'Invented tool' },
    ]) {
      await expect(
        apiFor('/api/admin/people/avery-cole?actor_id=sam-ochoa', {
          person_id: 'avery-cole',
          display_name: 'Avery Cole',
          email_address: 'avery@nelsonelectric.com',
          job_title: 'Apprentice electrician',
          role: 'worker',
          lifecycle: 'active',
          home_warehouse_id: 'north-yard',
          home_warehouse: 'North Yard',
          can_authenticate: true,
          held_tool_count: 0,
          pending_handoff_count: 0,
          held_tools: [],
          recent_events: [invalidEvent],
          warehouses: [warehouseReference],
          people: peopleReferences,
          tools: toolReferences,
        }).admin.getPerson!({ actorId: 'sam-ochoa', personId: 'avery-cole' }),
      ).rejects.toThrow(
        invalidEvent.actor_id === 'unknown-person' || invalidEvent.actor_name === 'Wrong name'
          ? 'event actor reference'
          : 'event tool reference',
      );
    }
    await expect(
      apiFor('/api/admin/people/avery-cole?actor_id=sam-ochoa', {
        person_id: 'avery-cole',
        display_name: 'Avery Cole',
        email_address: 'avery@nelsonelectric.com',
        job_title: 'Apprentice electrician',
        role: 'worker',
        lifecycle: 'active',
        home_warehouse_id: 'north-yard',
        home_warehouse: 'North Yard',
        can_authenticate: true,
        held_tool_count: 0,
        pending_handoff_count: 0,
        held_tools: [],
        recent_events: [{ ...detailEvent, warehouse_id: undefined, warehouse_name: undefined }],
        warehouses: [warehouseReference],
        people: peopleReferences,
        tools: toolReferences,
      }).admin.getPerson!({ actorId: 'sam-ochoa', personId: 'avery-cole' }),
    ).rejects.toThrow('event warehouse reference');

    const summary = await apiFor('/api/admin/summary?actor_id=sam-ochoa', {
      total_tools: 1,
      checked_out: 1,
      in_stock: 0,
      flagged: 0,
      people: peopleReferences,
      tools: toolReferences,
      warehouses: [
        {
          ...warehouseReference,
          address: '1420 Kerr Ave',
          manager_id: 'sam-ochoa',
          manager_name: 'Sam Ochoa',
          stock_count: 0,
          out_count: 1,
        },
      ],
      recent_events: [],
      pending_approvals: 0,
      long_held_tools: [heldTool],
    }).admin.getSummary();
    expect(summary.longHeldTools).toEqual([
      expect.objectContaining({
        toolUnitId: 'TL-101',
        holderSinceAt,
        holderSince,
      }),
    ]);

    for (const invalidTime of ['2026-02-30T10:00:00Z', '2026-08-17T10:18:00', '2026-08-17T10:18:00+24:00']) {
      await expect(
        apiFor('/api/admin/people/avery-cole?actor_id=sam-ochoa', {
          person_id: 'avery-cole',
          display_name: 'Avery Cole',
          email_address: 'avery@nelsonelectric.com',
          job_title: 'Apprentice electrician',
          role: 'worker',
          lifecycle: 'active',
          home_warehouse_id: 'north-yard',
          home_warehouse: 'North Yard',
          can_authenticate: true,
          held_tool_count: 1,
          pending_handoff_count: 0,
          held_tools: [{ ...heldTool, holder_since_at: invalidTime }],
          recent_events: [],
          warehouses: [warehouseReference],
          people: peopleReferences,
          tools: toolReferences,
        }).admin.getPerson!({ actorId: 'sam-ochoa', personId: 'avery-cole' }),
      ).rejects.toThrow('held tool time');
    }
    await expect(
      apiFor('/api/admin/people/avery-cole?actor_id=sam-ochoa', {
        person_id: 'avery-cole',
        display_name: 'Avery Cole',
        email_address: 'avery@nelsonelectric.com',
        job_title: 'Apprentice electrician',
        role: 'worker',
        lifecycle: 'active',
        home_warehouse_id: 'north-yard',
        home_warehouse: 'North Yard',
        can_authenticate: true,
        held_tool_count: 1,
        pending_handoff_count: 0,
        held_tools: [{ ...heldTool, holder_since: 'Yesterday' }],
        recent_events: [],
        warehouses: [warehouseReference],
        people: peopleReferences,
        tools: toolReferences,
      }).admin.getPerson!({ actorId: 'sam-ochoa', personId: 'avery-cole' }),
    ).rejects.toThrow('held tool time');
  });

  it('rejects contradictory held-tool counts and duplicate canonical reference rows', async () => {
    const heldTool = {
      tool_unit_id: 'TL-101',
      tool_name: 'Hammer drill',
      holder_since_at: '2026-08-10T09:00:00-06:00',
      holder_since: 'Aug 10, 2026, 9:00 AM',
      warehouse_id: 'north-yard',
      warehouse_name: 'North Yard',
      status: 'checked-out' as const,
    };
    const detail = {
      person_id: 'avery-cole',
      display_name: 'Avery Cole',
      email_address: 'avery@nelsonelectric.com',
      job_title: 'Apprentice electrician',
      role: 'worker' as const,
      lifecycle: 'active' as const,
      home_warehouse_id: 'north-yard',
      home_warehouse: 'North Yard',
      can_authenticate: true,
      held_tool_count: 1,
      pending_handoff_count: 0,
      held_tools: [heldTool],
      recent_events: [],
      warehouses: [warehouseReference],
      people: peopleReferences,
      tools: toolReferences,
    };
    await expect(
      apiFor('/api/admin/people/avery-cole?actor_id=sam-ochoa', { ...detail, held_tool_count: 2 }).admin.getPerson!({
        actorId: 'sam-ochoa',
        personId: 'avery-cole',
      }),
    ).rejects.toThrow('held tool count');
    await expect(
      apiFor('/api/admin/people/avery-cole?actor_id=sam-ochoa', {
        ...detail,
        held_tool_count: 2,
        held_tools: [heldTool, heldTool],
      }).admin.getPerson!({ actorId: 'sam-ochoa', personId: 'avery-cole' }),
    ).rejects.toThrow('held tool ids');
    await expect(
      apiFor('/api/admin/people/avery-cole?actor_id=sam-ochoa', {
        ...detail,
        people: [...peopleReferences, ...peopleReferences],
      }).admin.getPerson!({ actorId: 'sam-ochoa', personId: 'avery-cole' }),
    ).rejects.toThrow('duplicate admin person reference');
    await expect(
      apiFor('/api/admin/people/avery-cole?actor_id=sam-ochoa', {
        ...detail,
        warehouses: [warehouseReference, warehouseReference],
      }).admin.getPerson!({ actorId: 'sam-ochoa', personId: 'avery-cole' }),
    ).rejects.toThrow('duplicate admin warehouse reference');
  });
});
