import { describe, expect, it } from 'vitest';
import { assertReferences, createSeedState } from './seed';

describe('createSeedState', () => {
  it('validates all canonical references before projection', () => {
    expect(() => createSeedState()).not.toThrow();
  });

  it('isolates each returned state from the private canonical seed', () => {
    const first = createSeedState();
    first.users[0].name = 'Changed outside the seed';
    first.custody[0].sinceAt = '2026-08-18T10:00:00-06:00';
    if (first.custody[0].holder.type === 'worker') first.custody[0].holder.userId = 'changed-worker';
    if (first.handoffs[0].from.type === 'warehouse') first.handoffs[0].from.warehouseId = 'changed-warehouse';
    if (first.handoffs[0].to.type === 'worker') first.handoffs[0].to.userId = 'changed-worker';
    const second = createSeedState();
    expect(second.users[0].name).toBe('Ray Torres');
    expect(second.custody[0].sinceAt).toBe('2026-08-12T10:00:00-06:00');
    expect(second.custody[0].holder).toEqual({ type: 'worker', userId: 'ray-torres' });
    expect(second.handoffs[0].from).toEqual({ type: 'warehouse', warehouseId: 'north-yard' });
    expect(second.handoffs[0].to).toEqual({ type: 'worker', userId: 'ray-torres' });
  });

  it('rejects activity references to missing participants or warehouses', () => {
    const participantState = createSeedState();
    participantState.events[0] = { ...participantState.events[0], participantIds: ['missing-user'] };
    expect(() => assertReferences(participantState)).toThrow('Invalid audit event: EV-1');

    const warehouseState = createSeedState();
    warehouseState.events[0] = { ...warehouseState.events[0], warehouseId: 'missing-warehouse' };
    expect(() => assertReferences(warehouseState)).toThrow('Invalid audit event: EV-1');
  });

  it('rejects activity records without canonical scope or instants', () => {
    for (const occurredAt of ['not-a-timestamp', '2026-08-17', '2026-02-30T10:00:00Z', '0']) {
      const invalidState = createSeedState();
      invalidState.events[0] = { ...invalidState.events[0], occurredAt };
      expect(() => assertReferences(invalidState)).toThrow('Invalid audit event: EV-1');
    }
  });

  it('rejects activity records without a valid kind or tool reference', () => {
    const invalidKindState = createSeedState();
    invalidKindState.events[0] = { ...invalidKindState.events[0], kind: 'bogus' as never };
    expect(() => assertReferences(invalidKindState)).toThrow('Invalid audit event: EV-1');

    const missingToolState = createSeedState();
    missingToolState.events[0] = { ...missingToolState.events[0], toolUnitId: undefined, scope: 'warehouse' };
    expect(() => assertReferences(missingToolState)).toThrow('Invalid audit event: EV-1');

    const missingToolCustodyState = createSeedState();
    missingToolCustodyState.events[0] = {
      ...missingToolCustodyState.events[0],
      toolUnitId: undefined,
      kind: 'custody',
      scope: 'admin',
    };
    expect(() => assertReferences(missingToolCustodyState)).toThrow('Invalid audit event: EV-1');
  });

  it('requires explicit warehouse metadata for tool activity', () => {
    const invalidState = createSeedState();
    invalidState.events[0] = { ...invalidState.events[0], warehouseId: undefined };
    expect(() => assertReferences(invalidState)).toThrow('Invalid audit event: EV-1');
  });

  it('rejects custody records without canonical movement instants', () => {
    for (const sinceAt of ['Held 6 days', '2026-08-17']) {
      const invalidState = createSeedState();
      invalidState.custody[0] = { ...invalidState.custody[0], sinceAt };
      expect(() => assertReferences(invalidState)).toThrow('Invalid custody record: TL-101');
    }
  });

  it('rejects administrator custody records at the canonical boundary', () => {
    const invalidState = createSeedState();
    invalidState.custody[0] = { ...invalidState.custody[0], holder: { type: 'worker', userId: 'sam-ochoa' } };
    expect(() => assertReferences(invalidState)).toThrow('Invalid custody record: TL-101');
  });

  it('rejects tool units without canonical condition, lifecycle, or IDs', () => {
    const invalidConditionState = createSeedState();
    invalidConditionState.units[0] = { ...invalidConditionState.units[0], condition: 'bogus' as never };
    expect(() => assertReferences(invalidConditionState)).toThrow('Invalid tool unit: TL-101');

    const invalidLifecycleState = createSeedState();
    invalidLifecycleState.units[0] = { ...invalidLifecycleState.units[0], lifecycle: '' as never };
    expect(() => assertReferences(invalidLifecycleState)).toThrow('Invalid tool unit: TL-101');

    const invalidIdState = createSeedState();
    invalidIdState.units[0] = { ...invalidIdState.units[0], id: ' ' };
    expect(() => assertReferences(invalidIdState)).toThrow('Invalid tool unit:  ');
  });

  it('rejects blank canonical people, warehouse, and definition identities', () => {
    const blankUser = createSeedState();
    blankUser.users[0] = { ...blankUser.users[0], name: ' ' };
    expect(() => assertReferences(blankUser)).toThrow('Invalid user: ray-torres');

    const blankWarehouse = createSeedState();
    blankWarehouse.warehouses[0] = { ...blankWarehouse.warehouses[0], address: '\t' };
    expect(() => assertReferences(blankWarehouse)).toThrow('Invalid warehouse: north-yard');

    const blankDefinition = createSeedState();
    blankDefinition.definitions[0] = { ...blankDefinition.definitions[0], imageKey: '' };
    expect(() => assertReferences(blankDefinition)).toThrow('Invalid tool definition: def-hammer-drill');
  });

  it('rejects handoff records without canonical request instants', () => {
    for (const requestedAt of ['Today · 10:18 am', '2026-08-17T10:18:00']) {
      const invalidState = createSeedState();
      invalidState.handoffs[0] = { ...invalidState.handoffs[0], requestedAt };
      expect(() => assertReferences(invalidState)).toThrow('Invalid handoff: HO-1');
    }
  });

  it('rejects a pending handoff whose source is not the current holder', () => {
    const invalidState = createSeedState();
    invalidState.handoffs[0] = {
      ...invalidState.handoffs[0],
      from: { type: 'warehouse', warehouseId: 'south-shop' },
    };
    expect(() => assertReferences(invalidState)).toThrow('Invalid handoff: HO-1');
  });

  it('rejects a pending handoff for an archived unit', () => {
    const invalidState = createSeedState();
    invalidState.units = invalidState.units.map((unit) =>
      unit.id === invalidState.handoffs[0].toolUnitId ? { ...unit, lifecycle: 'archived' } : unit,
    );
    expect(() => assertReferences(invalidState)).toThrow('Invalid handoff: HO-1');
  });
});
