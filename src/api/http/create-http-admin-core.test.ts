import { describe, expect, it } from 'vitest';
import { apiFor } from './http-validation-fixtures';

const person = {
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
};

const warehouseReference = { warehouse_id: 'north-yard', name: 'North Yard' };
const personReference = {
  person_id: 'sam-ochoa',
  display_name: 'Sam Ochoa',
  role: 'admin',
  lifecycle: 'active',
};
const structuralRules = [
  {
    id: 'accepting-party-custody',
    label: 'Custody handoffs',
    description: 'Every handoff requires an accepting party before custody changes.',
    locked: true as const,
  },
  {
    id: 'immutable-audit-history',
    label: 'Audit history',
    description: 'The audit trail is immutable, including for administrators and owners.',
    locked: true as const,
  },
  {
    id: 'administer-people-authority',
    label: 'People administration',
    description: 'Only administrators can invite, change, suspend, or remove people.',
    locked: true as const,
  },
];

describe('HTTP admin people and command adapters', () => {
  it('maps people and permission rows through strict DTO boundaries', async () => {
    const people = await apiFor('/api/admin/people?actor_id=sam-ochoa', {
      people: [person],
      warehouses: [warehouseReference],
    }).admin.listPeople!({
      actorId: 'sam-ochoa',
    });
    expect(people[0]).toMatchObject({ id: 'casey-reed', lifecycle: 'invited', canAuthenticate: false });
    const detail = await apiFor('/api/admin/people/casey-reed?actor_id=sam-ochoa', {
      ...person,
      held_tools: [],
      recent_events: [],
      warehouses: [warehouseReference],
      people: [personReference],
      tools: [{ tool_unit_id: 'TL-101', name: 'Hammer drill' }],
    }).admin.getPerson!({ actorId: 'sam-ochoa', personId: 'casey-reed' });
    expect(detail).toMatchObject({ id: 'casey-reed', heldTools: [], recentEvents: [] });
    const permissions = await apiFor('/api/admin/permissions?actor_id=sam-ochoa', [
      {
        role: 'worker',
        label: 'Worker',
        capabilities: ['browse-tools', 'request-tools', 'preserve-audit-history'],
        structural_rules: structuralRules,
      },
      {
        role: 'warehouse-manager',
        label: 'Warehouse manager',
        capabilities: ['browse-tools', 'manage-warehouse', 'review-handoffs', 'preserve-audit-history'],
        structural_rules: structuralRules,
      },
      {
        role: 'admin',
        label: 'Administrator',
        capabilities: [
          'browse-tools',
          'manage-warehouse',
          'review-handoffs',
          'administer-people',
          'preserve-audit-history',
        ],
        structural_rules: structuralRules,
      },
    ]).admin.getPermissionMatrix!({ actorId: 'sam-ochoa' });
    expect(permissions).toEqual([
      {
        role: 'worker',
        label: 'Worker',
        capabilities: ['browse-tools', 'request-tools', 'preserve-audit-history'],
        structuralRules,
      },
      {
        role: 'warehouse-manager',
        label: 'Warehouse manager',
        capabilities: ['browse-tools', 'manage-warehouse', 'review-handoffs', 'preserve-audit-history'],
        structuralRules,
      },
      {
        role: 'admin',
        label: 'Administrator',
        capabilities: [
          'browse-tools',
          'manage-warehouse',
          'review-handoffs',
          'administer-people',
          'preserve-audit-history',
        ],
        structuralRules,
      },
    ]);
  });

  it('maps a non-empty warehouse directory through the shared reference authority', async () => {
    const warehouses = await apiFor('/api/admin/warehouses?actor_id=sam-ochoa', {
      people: [personReference],
      warehouses: [
        {
          warehouse_id: 'north-yard',
          name: 'North Yard',
          address: '1420 Kerr Ave',
          manager_id: 'sam-ochoa',
          manager_name: 'Sam Ochoa',
          stock_count: 9,
          out_count: 6,
          manager_role: 'admin',
          manager_lifecycle: 'active',
        },
      ],
    }).admin.listWarehouses!({ actorId: 'sam-ochoa' });
    expect(warehouses).toEqual([
      {
        id: 'north-yard',
        name: 'North Yard',
        address: '1420 Kerr Ave',
        managerId: 'sam-ochoa',
        manager: 'Sam Ochoa',
        tools: 9,
        out: 6,
        managerRole: 'admin',
        managerLifecycle: 'active',
      },
    ]);
  });

  it('rejects contradictory person authentication and duplicate capability evidence', async () => {
    await expect(
      apiFor('/api/admin/people?actor_id=sam-ochoa', {
        people: [{ ...person, can_authenticate: true }],
        warehouses: [warehouseReference],
      }).admin.listPeople!({
        actorId: 'sam-ochoa',
      }),
    ).rejects.toThrow('person authentication');
    await expect(
      apiFor('/api/admin/permissions?actor_id=sam-ochoa', [
        {
          role: 'worker',
          label: 'Worker',
          capabilities: ['browse-tools', 'browse-tools'],
          structural_rules: structuralRules,
        },
      ]).admin.getPermissionMatrix!({ actorId: 'sam-ochoa' }),
    ).rejects.toThrow('permission capabilities');
  });

  it('requires correlated command receipts and validates warehouse manager lifecycle', async () => {
    const receipt = {
      operation: 'invite-person',
      correlation_id: 'ADM-EV-7',
      event_id: 'EV-7',
      person_id: 'USR-1',
      affected_tool_unit_ids: [],
      affected_handoff_ids: [],
    };
    await expect(
      apiFor('/api/admin/people/invite', receipt).admin.invitePerson!({
        actorId: 'sam-ochoa',
        name: 'Jamie',
        email: 'jamie@example.com',
        title: 'Estimator',
        role: 'worker',
        homeWarehouseId: 'north-yard',
      }),
    ).resolves.toMatchObject({ correlationId: 'ADM-EV-7', personId: 'USR-1' });
    await expect(
      apiFor('/api/admin/people/invite', { ...receipt, correlation_id: 'wrong' }).admin.invitePerson!({
        actorId: 'sam-ochoa',
        name: 'Jamie',
        email: 'jamie@example.com',
        title: 'Estimator',
        role: 'worker',
        homeWarehouseId: 'north-yard',
      }),
    ).rejects.toThrow('mutation correlation');
    await expect(
      apiFor('/api/admin/warehouses?actor_id=sam-ochoa', {
        warehouses: [
          {
            warehouse_id: 'north-yard',
            name: 'North Yard',
            address: '1420 Kerr Ave',
            manager_id: 'sam-ochoa',
            manager_name: 'Sam Ochoa',
            stock_count: 1,
            out_count: 0,
            manager_role: 'admin',
            manager_lifecycle: 'suspended',
          },
        ],
        people: [{ ...personReference, lifecycle: 'suspended' }],
      }).admin.listWarehouses!({ actorId: 'sam-ochoa' }),
    ).rejects.toThrow('warehouse manager');
  });

  it('rejects operation receipts without their required subject reference', async () => {
    const receipt = {
      operation: 'remove-person',
      correlation_id: 'ADM-EV-9',
      event_id: 'EV-9',
      affected_tool_unit_ids: [],
      affected_handoff_ids: [],
    };
    await expect(
      apiFor('/api/admin/people/invite', receipt).admin.invitePerson!({
        actorId: 'sam-ochoa',
        name: 'Jamie',
        email: 'jamie@example.com',
        title: 'Estimator',
        role: 'worker',
        homeWarehouseId: 'north-yard',
      }),
    ).rejects.toThrow('mutation person reference');
    await expect(
      apiFor('/api/admin/warehouses', { ...receipt, operation: 'create-warehouse' }).admin.createWarehouse!({
        actorId: 'sam-ochoa',
        name: 'West Annex',
        address: '9 Line Ave',
        managerId: 'morgan-price',
      }),
    ).rejects.toThrow('mutation warehouse reference');
  });

  it('rejects blank and duplicate affected IDs in command receipts', async () => {
    const base = {
      operation: 'invite-person',
      correlation_id: 'ADM-EV-10',
      event_id: 'EV-10',
      person_id: 'USR-10',
      affected_tool_unit_ids: ['TL-101'],
      affected_handoff_ids: ['HO-1'],
    };
    await expect(
      apiFor('/api/admin/people/invite', { ...base, affected_tool_unit_ids: ['  '] }).admin.invitePerson!({
        actorId: 'sam-ochoa',
        name: 'Jamie',
        email: 'jamie@example.com',
        title: 'Estimator',
        role: 'worker',
        homeWarehouseId: 'north-yard',
      }),
    ).rejects.toThrow('mutation tool id');
    await expect(
      apiFor('/api/admin/people/invite', { ...base, affected_handoff_ids: ['HO-1', 'HO-1'] }).admin.invitePerson!({
        actorId: 'sam-ochoa',
        name: 'Jamie',
        email: 'jamie@example.com',
        title: 'Estimator',
        role: 'worker',
        homeWarehouseId: 'north-yard',
      }),
    ).rejects.toThrow('mutation handoff ids');
  });

  it('rejects unknown or mismatched cross-resource admin references', async () => {
    await expect(
      apiFor('/api/admin/people?actor_id=sam-ochoa', {
        people: [person],
        warehouses: [{ warehouse_id: 'south-shop', name: 'South Shop' }],
      }).admin.listPeople!({ actorId: 'sam-ochoa' }),
    ).rejects.toThrow('person warehouse reference');
    await expect(
      apiFor('/api/admin/warehouses?actor_id=sam-ochoa', {
        warehouses: [
          {
            warehouse_id: 'north-yard',
            name: 'North Yard',
            address: '1420 Kerr Ave',
            manager_id: 'missing-person',
            manager_name: 'Sam Ochoa',
            stock_count: 1,
            out_count: 0,
            manager_role: 'admin',
            manager_lifecycle: 'active',
          },
        ],
        people: [personReference],
      }).admin.listWarehouses!({ actorId: 'sam-ochoa' }),
    ).rejects.toThrow('warehouse manager reference');
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
        held_tools: [
          {
            tool_unit_id: 'TL-101',
            tool_name: 'Hammer drill',
            holder_since_at: '2026-08-10T09:00:00-06:00',
            holder_since: 'Aug 10, 2026, 9:00 AM',
            warehouse_id: 'south-shop',
            warehouse_name: 'South Shop',
            status: 'checked-out',
          },
        ],
        recent_events: [],
        warehouses: [warehouseReference],
        people: [personReference],
        tools: [{ tool_unit_id: 'TL-101', name: 'Hammer drill' }],
      }).admin.getPerson!({ actorId: 'sam-ochoa', personId: 'avery-cole' }),
    ).rejects.toThrow('held tool warehouse reference');
    await expect(
      apiFor('/api/admin/people?actor_id=sam-ochoa', {
        people: [person],
        warehouses: [warehouseReference, { ...warehouseReference, name: 'Duplicate North Yard' }],
      }).admin.listPeople!({ actorId: 'sam-ochoa' }),
    ).rejects.toThrow('duplicate admin warehouse reference');
    await expect(
      apiFor('/api/admin/people?actor_id=sam-ochoa', {
        people: 'not-an-array',
        warehouses: [warehouseReference],
      }).admin.listPeople!({ actorId: 'sam-ochoa' }),
    ).rejects.toThrow('admin people');
  });
});
