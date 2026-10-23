import { describe, expect, it } from 'vitest';
import { createMockApi } from './create-mock-api';
import { createMockDatabase } from './mock-database';
import { STRUCTURAL_PERMISSION_RULES } from '../../domain/permission-policy';

describe('admin people and warehouse commands', () => {
  it('projects lifecycle-aware people and permissions from the shared database', async () => {
    const api = createMockApi();
    const people = await api.admin.listPeople!({ actorId: 'sam-ochoa' });
    expect(people.map((person) => person.id)).toContain('casey-reed');
    expect(people.find((person) => person.id === 'casey-reed')).toMatchObject({
      lifecycle: 'invited',
      canAuthenticate: false,
    });
    expect(await api.admin.getPermissionMatrix!({ actorId: 'sam-ochoa' })).toEqual([
      {
        role: 'worker',
        label: 'Worker',
        capabilities: ['browse-tools', 'request-tools', 'preserve-audit-history'],
        structuralRules: STRUCTURAL_PERMISSION_RULES.map((rule) => ({ ...rule })),
      },
      {
        role: 'warehouse-manager',
        label: 'Warehouse manager',
        capabilities: ['browse-tools', 'manage-warehouse', 'review-handoffs', 'preserve-audit-history'],
        structuralRules: STRUCTURAL_PERMISSION_RULES.map((rule) => ({ ...rule })),
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
        structuralRules: STRUCTURAL_PERMISSION_RULES.map((rule) => ({ ...rule })),
      },
    ]);
  });

  it('orders long-held tools by the oldest canonical custody instant', async () => {
    const api = createMockApi(createMockDatabase({ clock: () => '2026-08-18T09:00:00-06:00' }));
    const summary = await api.admin.getSummary({ actorId: 'sam-ochoa' });
    expect(summary.longHeldTools.map((tool) => tool.toolUnitId)).toEqual(['TL-103']);
  });

  it('excludes archived units from long-held review rows', async () => {
    const database = createMockDatabase({ clock: () => '2026-08-18T09:00:00-06:00' });
    database.update((state) => {
      state.units = state.units.map((unit) => (unit.id === 'TL-103' ? { ...unit, lifecycle: 'archived' } : unit));
      return state;
    });
    const summary = await createMockApi(database).admin.getSummary({ actorId: 'sam-ochoa' });
    expect(summary.longHeldTools).toEqual([]);
  });

  it('rejects non-admin reads and keeps demo authority immutable', async () => {
    const api = createMockApi();
    await expect(api.admin.listPeople!({ actorId: 'ray-torres' })).rejects.toMatchObject({ code: 'forbidden' });
    await expect(
      api.admin.setPersonAccess!({ actorId: 'sam-ochoa', personId: 'ray-torres', access: 'suspended' }),
    ).rejects.toMatchObject({ code: 'conflict' });
    await expect(
      api.admin.setPersonAccess!({ actorId: 'sam-ochoa', personId: 'quinn-hart', access: 'active' }),
    ).rejects.toMatchObject({ code: 'conflict' });
    await expect(
      api.admin.updatePersonRole!({ actorId: 'sam-ochoa', personId: 'quinn-hart', role: 'admin' }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('rejects role and removal commands targeting either demo profile without mutation', async () => {
    const database = createMockDatabase();
    const api = createMockApi(database);
    const before = database.read();
    await expect(
      api.admin.updatePersonRole!({ actorId: 'sam-ochoa', personId: 'ray-torres', role: 'admin' }),
    ).rejects.toMatchObject({ code: 'conflict' });
    await expect(
      api.admin.removePerson!({ actorId: 'sam-ochoa', personId: 'ray-torres', reason: 'Leaving' }),
    ).rejects.toMatchObject({ code: 'conflict' });
    await expect(
      api.admin.updatePersonRole!({ actorId: 'sam-ochoa', personId: 'sam-ochoa', role: 'worker' }),
    ).rejects.toMatchObject({ code: 'conflict' });
    await expect(
      api.admin.removePerson!({ actorId: 'sam-ochoa', personId: 'sam-ochoa', reason: 'Leaving' }),
    ).rejects.toMatchObject({ code: 'conflict' });
    const after = database.read();
    expect(after.users).toEqual(before.users);
    expect(after.events).toEqual(before.events);
  });

  it.each(['ray-torres', 'taylor-nguyen'] as const)(
    'rejects every admin command from %s without state changes',
    async (actorId) => {
      const database = createMockDatabase();
      const api = createMockApi(database);
      const before = database.read();
      const commands = [
        () =>
          api.admin.invitePerson!({
            actorId,
            name: 'Jamie Park',
            email: 'jamie@example.com',
            title: 'Estimator',
            role: 'worker',
            homeWarehouseId: 'north-yard',
          }),
        () => api.admin.updatePersonRole!({ actorId, personId: 'casey-reed', role: 'admin' }),
        () => api.admin.setPersonAccess!({ actorId, personId: 'casey-reed', access: 'active' }),
        () => api.admin.removePerson!({ actorId, personId: 'casey-reed', reason: 'Leaving' }),
        () =>
          api.admin.createWarehouse!({ actorId, name: 'West Annex', address: '9 Line Ave', managerId: 'morgan-price' }),
        () =>
          api.admin.updateWarehouse!({
            actorId,
            warehouseId: 'north-yard',
            name: 'North Yard Updated',
            address: '1420 Kerr Ave',
            managerId: 'sam-ochoa',
          }),
      ];
      for (const command of commands) await expect(command()).rejects.toMatchObject({ code: 'forbidden' });
      expect(database.read()).toEqual(before);
    },
  );

  it('invites a person atomically and returns a correlated audit receipt', async () => {
    const database = createMockDatabase();
    const api = createMockApi(database);
    const result = await api.admin.invitePerson!({
      actorId: 'sam-ochoa',
      name: 'Jamie Park',
      email: ' JAMIE@NELSONELECTRIC.COM ',
      title: 'Estimator',
      role: 'worker',
      homeWarehouseId: 'north-yard',
    });
    expect(result).toMatchObject({ operation: 'invite-person', personId: 'USR-1', correlationId: 'ADM-EV-7' });
    expect(database.read().users.find((user) => user.id === result.personId)).toMatchObject({
      email: 'jamie@nelsonelectric.com',
      lifecycle: 'invited',
    });
    await expect(
      api.admin.invitePerson!({
        actorId: 'sam-ochoa',
        name: 'Jamie Duplicate',
        email: '  JAMIE@NELSONELECTRIC.COM  ',
        title: 'Estimator',
        role: 'worker',
        homeWarehouseId: 'north-yard',
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('rejects malformed invitation email addresses without mutating authority', async () => {
    const database = createMockDatabase();
    const before = database.read();
    await expect(
      createMockApi(database).admin.invitePerson({
        actorId: 'sam-ochoa',
        name: 'Invalid Person',
        email: 'not-an-email',
        title: 'Estimator',
        role: 'worker',
        homeWarehouseId: 'north-yard',
      }),
    ).rejects.toMatchObject({ code: 'invalid' });
    expect(database.read()).toEqual(before);
  });

  it('creates and updates warehouses only with active managers', async () => {
    const database = createMockDatabase();
    const api = createMockApi(database);
    const created = await api.admin.createWarehouse!({
      actorId: 'sam-ochoa',
      name: 'West Annex',
      address: '9 Line Ave',
      managerId: 'morgan-price',
    });
    expect(created).toMatchObject({
      operation: 'create-warehouse',
      warehouseId: 'WH-1',
      correlationId: 'ADM-' + created.eventId,
    });
    expect(database.read().events.at(-1)).toMatchObject({
      id: created.eventId,
      action: 'Created warehouse West Annex',
      warehouseId: 'WH-1',
      actorId: 'sam-ochoa',
    });
    const updated = await api.admin.updateWarehouse!({
      actorId: 'sam-ochoa',
      warehouseId: 'WH-1',
      name: 'West Annex Updated',
      address: '10 Line Ave',
      managerId: 'sam-ochoa',
    });
    expect(updated).toMatchObject({
      operation: 'update-warehouse',
      warehouseId: 'WH-1',
      correlationId: 'ADM-' + updated.eventId,
    });
    expect(database.read().events.at(-1)).toMatchObject({
      id: updated.eventId,
      action: 'Updated warehouse West Annex Updated',
      warehouseId: 'WH-1',
      actorId: 'sam-ochoa',
    });
    expect(database.read().warehouses.find((warehouse) => warehouse.id === 'WH-1')).toMatchObject({
      name: 'West Annex Updated',
      managerId: 'sam-ochoa',
    });
    await expect(
      api.admin.createWarehouse!({ actorId: 'sam-ochoa', name: 'Bad', address: 'x', managerId: 'taylor-nguyen' }),
    ).rejects.toMatchObject({ code: 'invalid' });
    await expect(
      api.admin.createWarehouse!({
        actorId: 'sam-ochoa',
        name: '  north yard  ',
        address: '11 Line Ave',
        managerId: 'morgan-price',
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
    await expect(
      api.admin.createWarehouse!({
        actorId: 'sam-ochoa',
        name: '   ',
        address: '12 Line Ave',
        managerId: 'morgan-price',
      }),
    ).rejects.toMatchObject({ code: 'invalid' });
    await expect(
      api.admin.updateWarehouse!({
        actorId: 'sam-ochoa',
        warehouseId: 'WH-1',
        name: 'West Annex Updated',
        address: '   ',
        managerId: 'morgan-price',
      }),
    ).rejects.toMatchObject({ code: 'invalid' });
  });

  it('keeps inactive workers out of command authority and transfer targets', async () => {
    const api = createMockApi();
    await expect(api.custody.requestTool({ actorId: 'taylor-nguyen', toolUnitId: 'TL-105' })).rejects.toMatchObject({
      code: 'forbidden',
    });
    await expect(
      api.custody.listTransferTargets({ actorId: 'taylor-nguyen', toolUnitId: 'TL-101' }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    await expect(
      api.tools.createTool({
        actorId: 'taylor-nguyen',
        warehouseId: 'north-yard',
        photoCaptured: true,
        definition: {
          name: 'Test',
          brand: 'Test',
          model: '1',
          categoryId: 'category-hand-tools',
          imageKey: 'hammer-drill.png',
        },
      }),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });

  it.each([
    ['casey-reed', 'invited'],
    ['taylor-nguyen', 'suspended'],
    ['quinn-hart', 'removed'],
  ] as const)('keeps %s (%s) out of every authority boundary', async (personId, _lifecycle) => {
    const api = createMockApi();
    await expect(api.auth.signInAs(personId)).rejects.toThrow();
    await expect(api.auth.restoreSession(personId)).resolves.toBeNull();
    await expect(api.custody.listTransferTargets({ actorId: personId, toolUnitId: 'TL-101' })).rejects.toMatchObject({
      code: 'forbidden',
    });
    await expect(
      api.admin.createWarehouse!({
        actorId: 'sam-ochoa',
        name: 'Blocked ' + personId,
        address: '1 Test Way',
        managerId: personId,
      }),
    ).rejects.toMatchObject({ code: 'invalid' });
  });

  it('keeps every inactive lifecycle out of active transfer targets', async () => {
    const api = createMockApi();
    const targets = await api.custody.listTransferTargets({ actorId: 'ray-torres', toolUnitId: 'TL-101' });
    const targetIds = targets.flatMap((target) => (target.type === 'worker' ? [target.userId] : []));
    expect(targetIds).not.toEqual(expect.arrayContaining(['casey-reed', 'taylor-nguyen', 'quinn-hart']));
  });

  it('emits correlated role-change receipts and canonical audit events', async () => {
    const database = createMockDatabase({ clock: () => '2026-08-18T12:00:00Z' });
    const api = createMockApi(database);
    const result = await api.admin.updatePersonRole!({
      actorId: 'sam-ochoa',
      personId: 'casey-reed',
      role: 'warehouse-manager',
    });
    expect(result).toMatchObject({
      operation: 'update-person-role',
      personId: 'casey-reed',
      correlationId: 'ADM-' + result.eventId,
    });
    expect(database.read().events.at(-1)).toMatchObject({
      id: result.eventId,
      action: "Changed Casey Reed's role to warehouse-manager",
      participantIds: ['sam-ochoa', 'casey-reed'],
      kind: 'admin',
    });
  });

  it('rejects role changes that would invalidate a pending worker handoff', async () => {
    const database = createMockDatabase();
    database.update((state) => ({
      ...state,
      users: [
        ...state.users,
        {
          id: 'jordan-lee',
          name: 'Jordan Lee',
          email: 'jordan@nelsonelectric.com',
          role: 'worker',
          lifecycle: 'active',
          title: 'Apprentice electrician',
          homeWarehouseId: 'north-yard',
        },
      ],
    }));
    const api = createMockApi(database);
    await api.custody.startTransfer({
      toolUnitId: 'TL-101',
      actorId: 'ray-torres',
      to: { type: 'worker', userId: 'jordan-lee' },
    });
    await expect(
      api.admin.updatePersonRole!({ actorId: 'sam-ochoa', personId: 'jordan-lee', role: 'admin' }),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(database.read().users.find((person) => person.id === 'jordan-lee')?.role).toBe('worker');
  });
});
