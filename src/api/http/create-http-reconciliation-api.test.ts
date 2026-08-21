import { describe, expect, it } from 'vitest';
import { createHttpReconciliationApi } from './create-http-reconciliation-api';
import type { HttpTransport } from './create-http-api';

const worker = { kind: 'worker' as const, id: 'ray-torres', label: 'Ray Torres' };
const warehouse = { kind: 'warehouse' as const, id: 'north-yard', label: 'North Yard' };

const duplicate = {
  issue_id: 'REC-1',
  kind: 'duplicate-tool-record' as const,
  candidate_tool_unit_ids: ['TL-101', 'TL-103'] as [string, string],
  candidate_names: ['Hammer drill · TL-101', 'Hammer drill · TL-103'] as [string, string],
  candidate_revisions: [1, 1] as [number, number],
  candidate_holders: [worker, worker] as [typeof worker, typeof worker],
  reason: 'Two active records share a serial.',
  detected_at: '2026-08-17T10:00:00-06:00',
  revision: 1,
  status: 'open' as const,
};

const mismatch = {
  issue_id: 'REC-2',
  kind: 'custody-mismatch' as const,
  tool_unit_id: 'TL-105',
  tool_name: 'Rotary hammer',
  recorded_holder: warehouse,
  observed_holder: { kind: 'warehouse' as const, id: 'south-shop', label: 'South Shop' },
  recorded_label: 'North Yard',
  observed_label: 'South Shop',
  tool_revision: 1,
  reason: 'Observed location differs from the ledger.',
  detected_at: '2026-08-16T09:00:00-06:00',
  revision: 2,
  status: 'resolved' as const,
};

const receipt = (operation: string, issueId: string, affectedToolUnitIds: string[]) => ({
  operation,
  correlation_id: 'REC-EV-1',
  event_id: 'EV-1',
  issue_id: issueId,
  affected_tool_unit_ids: affectedToolUnitIds,
});

describe('HTTP reconciliation boundary', () => {
  it('maps open work, filters resolved history, and enforces aggregate counts', async () => {
    const api = createHttpReconciliationApi({
      transport: {
        get: (async () => ({
          issues: [duplicate, mismatch],
          open_count: 1,
          resolved_count: 1,
        })) as HttpTransport['get'],
        post: (async () => receipt('dismiss-duplicate', 'REC-1', [])) as HttpTransport['post'],
      },
    });
    await expect(api.listIssues({ actorId: 'sam-ochoa' })).resolves.toEqual({
      issues: [
        expect.objectContaining({
          id: 'REC-1',
          kind: 'duplicate-tool-record',
          candidateToolUnitIds: ['TL-101', 'TL-103'],
          candidateHolders: [
            { type: 'worker', userId: 'ray-torres' },
            { type: 'worker', userId: 'ray-torres' },
          ],
        }),
      ],
      openCount: 1,
      resolvedCount: 1,
    });
    const malformed = createHttpReconciliationApi({
      transport: {
        get: (async () => ({
          issues: [duplicate, mismatch],
          open_count: 2,
          resolved_count: 0,
        })) as HttpTransport['get'],
        post: (async () => receipt('dismiss-duplicate', 'REC-1', [])) as HttpTransport['post'],
      },
    });
    await expect(malformed.listIssues({ actorId: 'sam-ochoa' })).rejects.toThrow('aggregate counts');
  });

  it('sends canonical command bodies and rejects receipt references that do not match the command', async () => {
    const calls: Array<{ path: string; body: unknown }> = [];
    let response: unknown = receipt('dismiss-duplicate', 'REC-1', []);
    const api = createHttpReconciliationApi({
      transport: {
        get: (async () => ({ issues: [], open_count: 0, resolved_count: 0 })) as HttpTransport['get'],
        post: (async <T>(path: string, body: unknown) => {
          calls.push({ path, body });
          return response as T;
        }) as HttpTransport['post'],
      },
    });
    await api.dismissDuplicate({ actorId: 'sam-ochoa', issueId: 'REC-1', expectedIssueRevision: 1 });
    expect(calls[0]).toEqual({
      path: '/api/admin/reconciliation/REC-1/dismiss',
      body: { actor_id: 'sam-ochoa', expected_issue_revision: 1 },
    });

    response = receipt('merge-duplicate', 'REC-1', ['TL-101', 'TL-103']);
    await api.mergeDuplicate({
      actorId: 'sam-ochoa',
      issueId: 'REC-1',
      expectedIssueRevision: 1,
      survivorToolUnitId: 'TL-101',
      retiredToolUnitId: 'TL-103',
      expectedSurvivorRevision: 1,
      expectedRetiredRevision: 1,
      expectedSurvivorHolder: { type: 'worker', userId: 'ray-torres' },
      expectedRetiredHolder: { type: 'worker', userId: 'ray-torres' },
      note: ' verified ',
    });
    expect(calls[1]).toEqual({
      path: '/api/admin/reconciliation/REC-1/merge',
      body: {
        actor_id: 'sam-ochoa',
        expected_issue_revision: 1,
        survivor_tool_unit_id: 'TL-101',
        retired_tool_unit_id: 'TL-103',
        expected_survivor_revision: 1,
        expected_retired_revision: 1,
        expected_survivor_holder: { kind: 'worker', id: 'ray-torres' },
        expected_retired_holder: { kind: 'worker', id: 'ray-torres' },
        note: ' verified ',
      },
    });

    response = receipt('resolve-custody-mismatch', 'REC-2', ['TL-105']);
    await api.resolveCustodyMismatch({
      actorId: 'sam-ochoa',
      issueId: 'REC-2',
      expectedIssueRevision: 2,
      toolUnitId: 'TL-105',
      expectedToolRevision: 1,
      expectedRecordedHolder: { type: 'warehouse', warehouseId: 'north-yard' },
      decision: 'keep-recorded',
    });
    expect(calls[2]).toEqual({
      path: '/api/admin/reconciliation/REC-2/resolve-custody',
      body: {
        actor_id: 'sam-ochoa',
        expected_issue_revision: 2,
        tool_unit_id: 'TL-105',
        expected_tool_revision: 1,
        expected_recorded_holder: { kind: 'warehouse', id: 'north-yard' },
        decision: 'keep-recorded',
      },
    });

    response = receipt('dismiss-duplicate', 'REC-999', []);
    await expect(
      api.dismissDuplicate({ actorId: 'sam-ochoa', issueId: 'REC-1', expectedIssueRevision: 1 }),
    ).rejects.toThrow('references');

    response = { ...receipt('dismiss-duplicate', 'REC-1', []), operation: 'merge-duplicate' };
    await expect(
      api.dismissDuplicate({ actorId: 'sam-ochoa', issueId: 'REC-1', expectedIssueRevision: 1 }),
    ).rejects.toThrow('reconciliation receipt');
    response = { ...receipt('dismiss-duplicate', 'REC-1', []), correlation_id: 'REC-WRONG' };
    await expect(
      api.dismissDuplicate({ actorId: 'sam-ochoa', issueId: 'REC-1', expectedIssueRevision: 1 }),
    ).rejects.toThrow('reconciliation receipt');
    response = receipt('dismiss-duplicate', 'REC-1', ['TL-101', 'TL-101']);
    await expect(
      api.dismissDuplicate({ actorId: 'sam-ochoa', issueId: 'REC-1', expectedIssueRevision: 1 }),
    ).rejects.toThrow('reconciliation tool ids');
  });

  it('sorts mixed-offset detections canonically, appends stable candidate IDs, and rejects duplicate issue IDs', async () => {
    const api = createHttpReconciliationApi({
      transport: {
        get: (async () => ({
          issues: [
            { ...duplicate, candidate_names: ['Hammer drill', 'Hammer drill'] as [string, string] },
            { ...mismatch, status: 'open' as const, detected_at: '2026-08-17T10:30:00-06:00' },
          ],
          open_count: 2,
          resolved_count: 0,
        })) as HttpTransport['get'],
        post: (async () => receipt('dismiss-duplicate', 'REC-1', [])) as HttpTransport['post'],
      },
    });
    await expect(api.listIssues({ actorId: 'sam-ochoa' })).resolves.toMatchObject({
      issues: [{ id: 'REC-2' }, { id: 'REC-1', candidateNames: ['Hammer drill · TL-101', 'Hammer drill · TL-103'] }],
    });
    const duplicateId = createHttpReconciliationApi({
      transport: {
        get: (async () => ({
          issues: [duplicate, { ...duplicate, reason: 'same id' }],
          open_count: 2,
          resolved_count: 0,
        })) as HttpTransport['get'],
        post: (async () => receipt('dismiss-duplicate', 'REC-1', [])) as HttpTransport['post'],
      },
    });
    await expect(duplicateId.listIssues({ actorId: 'sam-ochoa' })).rejects.toThrow('reconciliation issues');

    const sameHolder = createHttpReconciliationApi({
      transport: {
        get: (async () => ({
          issues: [{ ...mismatch, status: 'open' as const, observed_holder: warehouse, observed_label: 'North Yard' }],
          open_count: 1,
          resolved_count: 0,
        })) as HttpTransport['get'],
        post: (async () => receipt('dismiss-duplicate', 'REC-1', [])) as HttpTransport['post'],
      },
    });
    await expect(sameHolder.listIssues({ actorId: 'sam-ochoa' })).rejects.toThrow('holders must differ');

    const missingRevisions = createHttpReconciliationApi({
      transport: {
        get: (async () => ({
          issues: [{ ...duplicate, candidate_revisions: undefined }],
          open_count: 1,
          resolved_count: 0,
        })) as HttpTransport['get'],
        post: (async () => receipt('dismiss-duplicate', 'REC-1', [])) as HttpTransport['post'],
      },
    });
    await expect(missingRevisions.listIssues({ actorId: 'sam-ochoa' })).rejects.toThrow('duplicate revisions');
  });
});
