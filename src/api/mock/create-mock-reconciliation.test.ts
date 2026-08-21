import { describe, expect, it } from 'vitest';
import { createMockApi } from './create-mock-api';
import { createMockDatabase } from './mock-database';

describe('mock reconciliation authority', () => {
  it('retains and dismisses duplicate issues with one correlated audit event', async () => {
    const database = createMockDatabase({ clock: () => '2026-08-18T10:00:00-06:00' });
    const api = createMockApi(database);
    const before = database.read();
    const board = await api.reconciliation.listIssues({ actorId: 'sam-ochoa' });
    const duplicate = board.issues.find((issue) => issue.kind === 'duplicate-tool-record');
    expect(duplicate?.status).toBe('open');
    const receipt = await api.reconciliation.dismissDuplicate({
      actorId: 'sam-ochoa',
      issueId: duplicate!.id,
      expectedIssueRevision: duplicate!.revision,
      note: 'Reviewed cycle-count evidence',
    });
    const after = database.read();
    expect(receipt.correlationId).toBe('REC-' + receipt.eventId);
    expect(receipt).toEqual({
      operation: 'dismiss-duplicate',
      correlationId: 'REC-' + receipt.eventId,
      eventId: receipt.eventId,
      issueId: duplicate!.id,
      affectedToolUnitIds: [],
    });
    expect(after.reconciliationIssues.find((issue) => issue.id === duplicate!.id)).toMatchObject({
      status: 'resolved',
      revision: 2,
    });
    expect(after.events.slice(0, before.events.length)).toEqual(before.events);
    expect(after.events).toHaveLength(before.events.length + 1);
    expect(after.events.at(-1)).toEqual({
      id: receipt.eventId,
      actorId: 'sam-ochoa',
      action: 'Dismissed duplicate tool record ' + duplicate!.id,
      kind: 'admin',
      scope: 'admin',
      participantIds: ['sam-ochoa'],
      warehouseId: 'north-yard',
      occurredAt: '2026-08-18T10:00:00-06:00',
      evidence: { note: 'Reviewed cycle-count evidence' },
    });
    await expect(
      api.reconciliation.dismissDuplicate({
        actorId: 'sam-ochoa',
        issueId: duplicate!.id,
        expectedIssueRevision: duplicate!.revision,
      }),
    ).rejects.toThrow('already resolved');
  });

  it('merges matching records without rewriting historical events or custody', async () => {
    const database = createMockDatabase({ clock: () => '2026-08-18T10:00:00-06:00' });
    const api = createMockApi(database);
    const board = await api.reconciliation.listIssues({ actorId: 'sam-ochoa' });
    const duplicate = board.issues.find((issue) => issue.kind === 'duplicate-tool-record')!;
    const before = database.read();
    const mergeInput = {
      actorId: 'sam-ochoa',
      issueId: duplicate.id,
      expectedIssueRevision: duplicate.revision,
      survivorToolUnitId: duplicate.candidateToolUnitIds[0],
      retiredToolUnitId: duplicate.candidateToolUnitIds[1],
      expectedSurvivorRevision: duplicate.candidateRevisions[0],
      expectedRetiredRevision: duplicate.candidateRevisions[1],
      expectedSurvivorHolder: duplicate.candidateHolders[0],
      expectedRetiredHolder: duplicate.candidateHolders[1],
    };
    const receipt = await api.reconciliation.mergeDuplicate(mergeInput);
    const after = database.read();
    expect(receipt.affectedToolUnitIds).toEqual(['TL-101', 'TL-103']);
    expect(after.units.find((unit) => unit.id === 'TL-101')?.lifecycle).toBe('active');
    expect(after.units.find((unit) => unit.id === 'TL-103')?.lifecycle).toBe('archived');
    expect(after.custody).toEqual(before.custody);
    expect(after.events.slice(0, before.events.length).map((event) => event.toolUnitId)).toEqual(
      before.events.map((event) => event.toolUnitId),
    );
    expect(after.events.slice(0, before.events.length)).toEqual(before.events);
    expect(after.events).toHaveLength(before.events.length + 1);
    expect(receipt).toEqual({
      operation: 'merge-duplicate',
      correlationId: 'REC-' + receipt.eventId,
      eventId: receipt.eventId,
      issueId: duplicate.id,
      affectedToolUnitIds: ['TL-101', 'TL-103'],
    });
    expect(after.events.at(-1)).toEqual({
      id: receipt.eventId,
      actorId: 'sam-ochoa',
      action: 'Merged TL-103 into TL-101',
      toolUnitId: 'TL-101',
      kind: 'admin',
      scope: 'admin',
      participantIds: ['sam-ochoa'],
      warehouseId: 'north-yard',
      occurredAt: '2026-08-18T10:00:00-06:00',
    });
    expect(after.reconciliationIssues.find((issue) => issue.id === duplicate.id)).toMatchObject({
      status: 'resolved',
      resolution: { type: 'merged', survivorToolUnitId: 'TL-101', retiredToolUnitId: 'TL-103' },
    });
    const beforeRepeat = database.read();
    await expect(api.reconciliation.mergeDuplicate(mergeInput)).rejects.toThrow('already resolved');
    expect(database.read()).toEqual(beforeRepeat);
  });

  it('resolves an observed warehouse mismatch while preserving origin provenance', async () => {
    const database = createMockDatabase({ clock: () => '2026-08-18T10:00:00-06:00' });
    const api = createMockApi(database);
    const issue = (await api.reconciliation.listIssues({ actorId: 'sam-ochoa' })).issues.find(
      (candidate) => candidate.kind === 'custody-mismatch',
    )!;
    const before = database.read();
    const mismatchInput = {
      actorId: 'sam-ochoa',
      issueId: issue.id,
      expectedIssueRevision: issue.revision,
      toolUnitId: issue.toolUnitId,
      expectedToolRevision: issue.toolRevision,
      expectedRecordedHolder: issue.recordedHolder,
      decision: 'accept-observed',
    } as const;
    const receipt = await api.reconciliation.resolveCustodyMismatch(mismatchInput);
    const after = database.read();
    expect(receipt.affectedToolUnitIds).toEqual(['TL-105']);
    expect(after.units.find((unit) => unit.id === 'TL-105')).toMatchObject({
      originWarehouseId: 'north-yard',
      assignedWarehouseId: 'south-shop',
    });
    expect(after.custody.find((record) => record.toolUnitId === 'TL-105')?.holder).toEqual({
      type: 'warehouse',
      warehouseId: 'south-shop',
    });
    expect(after.events).toHaveLength(before.events.length + 1);
    expect(after.events.slice(0, before.events.length)).toEqual(before.events);
    expect(receipt).toEqual({
      operation: 'resolve-custody-mismatch',
      correlationId: 'REC-' + receipt.eventId,
      eventId: receipt.eventId,
      issueId: issue.id,
      affectedToolUnitIds: ['TL-105'],
    });
    expect(after.events.at(-1)).toEqual({
      id: receipt.eventId,
      actorId: 'sam-ochoa',
      action: 'Accepted observed custody for TL-105',
      toolUnitId: 'TL-105',
      kind: 'admin',
      scope: 'admin',
      participantIds: ['sam-ochoa'],
      warehouseId: 'south-shop',
      occurredAt: '2026-08-18T10:00:00-06:00',
    });
    const beforeRepeat = database.read();
    await expect(api.reconciliation.resolveCustodyMismatch(mismatchInput)).rejects.toThrow('already resolved');
    expect(database.read()).toEqual(beforeRepeat);
  });
});
