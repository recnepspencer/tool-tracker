import { describe, expect, it } from 'vitest';
import { createHttpApi, type HttpTransport } from './create-http-api';

describe('HTTP admin command boundaries', () => {
  it('maps every admin command path and body with full correlated receipts', async () => {
    const calls: Array<{ path: string; body: unknown }> = [];
    let response: unknown;
    const api = createHttpApi({
      transport: {
        get: (async () => []) as HttpTransport['get'],
        post: (async <T>(path: string, body: unknown) => {
          calls.push({ path, body });
          return response as T;
        }) as HttpTransport['post'],
      },
    });
    const receipt = (
      operation: string,
      eventId: string,
      references: Record<string, string> = {},
      affectedToolUnitIds: string[] = [],
      affectedHandoffIds: string[] = [],
    ) => ({
      operation,
      correlation_id: 'ADM-' + eventId,
      event_id: eventId,
      ...references,
      affected_tool_unit_ids: affectedToolUnitIds,
      affected_handoff_ids: affectedHandoffIds,
    });
    const assertReceipt = (
      value: unknown,
      operation: string,
      eventId: string,
      references: Record<string, string>,
      affectedToolUnitIds: string[],
      affectedHandoffIds: string[],
    ) =>
      expect(value).toEqual({
        operation,
        correlationId: 'ADM-' + eventId,
        eventId,
        ...(references.person_id ? { personId: references.person_id } : {}),
        ...(references.warehouse_id ? { warehouseId: references.warehouse_id } : {}),
        affectedToolUnitIds,
        affectedHandoffIds,
      });

    const inviteRefs = { person_id: 'USR-1' };
    response = receipt('invite-person', 'EV-1', inviteRefs);
    const invited = await api.admin.invitePerson({
      actorId: 'sam-ochoa',
      name: ' Jamie Park ',
      email: ' JAMIE@NELSON.TEST ',
      title: ' Estimator ',
      role: 'worker',
      homeWarehouseId: 'north-yard',
    });
    assertReceipt(invited, 'invite-person', 'EV-1', inviteRefs, [], []);
    expect(calls.pop()).toEqual({
      path: '/api/admin/people/invite',
      body: {
        actor_id: 'sam-ochoa',
        display_name: ' Jamie Park ',
        email_address: 'jamie@nelson.test',
        job_title: ' Estimator ',
        role: 'worker',
        home_warehouse_id: 'north-yard',
      },
    });
    const callCountAfterInvite = calls.length;
    await expect(
      api.admin.invitePerson({
        actorId: 'sam-ochoa',
        name: 'Invalid Person',
        email: 'not-an-email',
        title: 'Estimator',
        role: 'worker',
        homeWarehouseId: 'north-yard',
      }),
    ).rejects.toThrow('Enter a valid email address');
    expect(calls).toHaveLength(callCountAfterInvite);

    const roleRefs = { person_id: 'avery/cole' };
    response = receipt('update-person-role', 'EV-2', roleRefs, ['TL-101']);
    const roleChanged = await api.admin.updatePersonRole({
      actorId: 'sam-ochoa',
      personId: 'avery/cole',
      role: 'warehouse-manager',
    });
    assertReceipt(roleChanged, 'update-person-role', 'EV-2', roleRefs, ['TL-101'], []);
    expect(calls.pop()).toEqual({
      path: '/api/admin/people/avery%2Fcole/role',
      body: { actor_id: 'sam-ochoa', role: 'warehouse-manager' },
    });
    response = receipt('update-person-role', 'EV-20', { person_id: 'other-person' });
    await expect(
      api.admin.updatePersonRole({ actorId: 'sam-ochoa', personId: 'avery/cole', role: 'worker' }),
    ).rejects.toThrow('mutation person reference');

    const accessRefs = { person_id: 'avery/cole' };
    response = receipt('set-person-access', 'EV-3', accessRefs, ['TL-115'], ['HO-2']);
    const accessChanged = await api.admin.setPersonAccess({
      actorId: 'sam-ochoa',
      personId: 'avery/cole',
      access: 'suspended',
    });
    assertReceipt(accessChanged, 'set-person-access', 'EV-3', accessRefs, ['TL-115'], ['HO-2']);
    expect(calls.pop()).toEqual({
      path: '/api/admin/people/avery%2Fcole/access',
      body: { actor_id: 'sam-ochoa', access: 'suspended' },
    });
    response = receipt('set-person-access', 'EV-30', { person_id: 'other-person' });
    await expect(
      api.admin.setPersonAccess({ actorId: 'sam-ochoa', personId: 'avery/cole', access: 'active' }),
    ).rejects.toThrow('mutation person reference');

    const removeRefs = { person_id: 'avery/cole' };
    response = receipt('remove-person', 'EV-4', removeRefs, ['TL-115'], ['HO-2']);
    const removed = await api.admin.removePerson({
      actorId: 'sam-ochoa',
      personId: 'avery/cole',
      reason: 'Contract ended',
      note: 'Exit',
    });
    assertReceipt(removed, 'remove-person', 'EV-4', removeRefs, ['TL-115'], ['HO-2']);
    expect(calls.pop()).toEqual({
      path: '/api/admin/people/avery%2Fcole/remove',
      body: { actor_id: 'sam-ochoa', reason: 'Contract ended', note: 'Exit' },
    });
    response = receipt('remove-person', 'EV-40', { person_id: 'other-person' });
    await expect(
      api.admin.removePerson({ actorId: 'sam-ochoa', personId: 'avery/cole', reason: 'Contract ended' }),
    ).rejects.toThrow('mutation person reference');

    const createWarehouseRefs = { warehouse_id: 'yard/one' };
    response = receipt('create-warehouse', 'EV-5', createWarehouseRefs);
    const warehouseCreated = await api.admin.createWarehouse({
      actorId: 'sam-ochoa',
      name: 'West Annex',
      address: '9 Line Ave',
      managerId: 'morgan-price',
    });
    assertReceipt(warehouseCreated, 'create-warehouse', 'EV-5', createWarehouseRefs, [], []);
    expect(calls.pop()).toEqual({
      path: '/api/admin/warehouses',
      body: { actor_id: 'sam-ochoa', name: 'West Annex', address: '9 Line Ave', manager_id: 'morgan-price' },
    });
    const updateWarehouseRefs = { warehouse_id: 'yard/one' };
    response = receipt('update-warehouse', 'EV-6', updateWarehouseRefs);
    const warehouseUpdated = await api.admin.updateWarehouse({
      actorId: 'sam-ochoa',
      warehouseId: 'yard/one',
      name: 'West Annex Updated',
      address: '10 Line Ave',
      managerId: 'sam-ochoa',
    });
    assertReceipt(warehouseUpdated, 'update-warehouse', 'EV-6', updateWarehouseRefs, [], []);
    expect(calls.pop()).toEqual({
      path: '/api/admin/warehouses/yard%2Fone',
      body: {
        actor_id: 'sam-ochoa',
        name: 'West Annex Updated',
        address: '10 Line Ave',
        manager_id: 'sam-ochoa',
      },
    });
    response = receipt('update-warehouse', 'EV-60', { warehouse_id: 'other-yard' });
    await expect(
      api.admin.updateWarehouse({
        actorId: 'sam-ochoa',
        warehouseId: 'yard/one',
        name: 'West Annex Updated',
        address: '10 Line Ave',
        managerId: 'sam-ochoa',
      }),
    ).rejects.toThrow('mutation warehouse reference');
  });
});
