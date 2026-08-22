import { describe, expect, it } from 'vitest';
import { createMockApi } from './create-mock-api';
import { createMockDatabase } from './mock-database';

const duplicateInput = async (api: ReturnType<typeof createMockApi>) => {
  const issue = (await api.reconciliation.listIssues({ actorId: 'sam-ochoa' })).issues.find(
    (candidate) => candidate.kind === 'duplicate-tool-record',
  );
  if (!issue || issue.kind !== 'duplicate-tool-record') throw new Error('missing duplicate fixture');
  return issue;
};

describe('mock reconciliation adversarial authority', () => {
  it('executes the seeded merge and removes the resolved issue from the worklist', async () => {
    const database = createMockDatabase();
    const api = createMockApi(database);
    const issue = await duplicateInput(api);
    await api.reconciliation.mergeDuplicate({
      actorId: 'sam-ochoa',
      issueId: issue.id,
      expectedIssueRevision: issue.revision,
      survivorToolUnitId: issue.candidateToolUnitIds[0],
      retiredToolUnitId: issue.candidateToolUnitIds[1],
      expectedSurvivorRevision: issue.candidateRevisions[0],
      expectedRetiredRevision: issue.candidateRevisions[1],
      expectedSurvivorHolder: issue.candidateHolders[0],
      expectedRetiredHolder: issue.candidateHolders[1],
    });
    const board = await api.reconciliation.listIssues({ actorId: 'sam-ochoa' });
    expect(board.issues.some((candidate) => candidate.id === issue.id)).toBe(false);
    expect(board.openCount).toBe(4);
    expect(database.read().units.find((unit) => unit.id === 'TL-103')?.lifecycle).toBe('archived');
  });

  it('rejects unauthorized, stale, and pending-handoff merges without partial writes', async () => {
    const unauthorizedDatabase = createMockDatabase();
    const unauthorizedApi = createMockApi(unauthorizedDatabase);
    const issue = await duplicateInput(unauthorizedApi);
    const beforeUnauthorized = unauthorizedDatabase.read();
    const args = {
      issueId: issue.id,
      expectedIssueRevision: issue.revision,
      survivorToolUnitId: issue.candidateToolUnitIds[0],
      retiredToolUnitId: issue.candidateToolUnitIds[1],
      expectedSurvivorRevision: issue.candidateRevisions[0],
      expectedRetiredRevision: issue.candidateRevisions[1],
      expectedSurvivorHolder: issue.candidateHolders[0],
      expectedRetiredHolder: issue.candidateHolders[1],
    };
    await expect(unauthorizedApi.reconciliation.mergeDuplicate({ actorId: 'ray-torres', ...args })).rejects.toThrow(
      'active administrator',
    );
    expect(unauthorizedDatabase.read()).toEqual(beforeUnauthorized);

    const pendingDatabase = createMockDatabase();
    const pendingApi = createMockApi(pendingDatabase);
    await pendingApi.custody.startTransfer({
      actorId: 'ray-torres',
      toolUnitId: 'TL-101',
      to: { type: 'worker', userId: 'avery-cole' },
    });
    const pendingIssue = await duplicateInput(pendingApi);
    const beforePending = pendingDatabase.read();
    await expect(pendingApi.reconciliation.mergeDuplicate({ actorId: 'sam-ochoa', ...args })).rejects.toThrow(
      'Pending handoffs',
    );
    expect(pendingDatabase.read()).toEqual(beforePending);

    const staleDatabase = createMockDatabase();
    const staleApi = createMockApi(staleDatabase);
    const staleIssue = await duplicateInput(staleApi);
    const beforeStale = staleDatabase.read();
    await expect(
      staleApi.reconciliation.dismissDuplicate({
        actorId: 'sam-ochoa',
        issueId: staleIssue.id,
        expectedIssueRevision: staleIssue.revision + 1,
      }),
    ).rejects.toThrow('changed');
    expect(staleDatabase.read()).toEqual(beforeStale);
    expect(pendingIssue.id).toBe(issue.id);
  });

  it('supports keep-recorded mismatch resolution without changing custody', async () => {
    const database = createMockDatabase();
    const api = createMockApi(database);
    const issue = (await api.reconciliation.listIssues({ actorId: 'sam-ochoa' })).issues.find(
      (candidate) => candidate.kind === 'custody-mismatch',
    );
    if (!issue || issue.kind !== 'custody-mismatch') throw new Error('missing mismatch fixture');
    const before = database.read();
    const receipt = await api.reconciliation.resolveCustodyMismatch({
      actorId: 'sam-ochoa',
      issueId: issue.id,
      expectedIssueRevision: issue.revision,
      toolUnitId: issue.toolUnitId,
      expectedToolRevision: issue.toolRevision,
      expectedRecordedHolder: issue.recordedHolder,
      decision: 'keep-recorded',
      note: 'Observed scan not trusted',
    });
    const after = database.read();
    expect(receipt.affectedToolUnitIds).toEqual(['TL-105']);
    expect(after.custody).toEqual(before.custody);
    expect(after.units).toEqual(before.units);
    expect(after.reconciliationIssues.find((candidate) => candidate.id === issue.id)?.status).toBe('resolved');
    expect(after.events).toHaveLength(before.events.length + 1);
  });

  it('rejects stale unit revisions, holders, candidates, and mismatch reads without writes', async () => {
    const revisionDatabase = createMockDatabase();
    const revisionApi = createMockApi(revisionDatabase);
    const revisionIssue = await duplicateInput(revisionApi);
    const mergeArgs = {
      issueId: revisionIssue.id,
      expectedIssueRevision: revisionIssue.revision,
      survivorToolUnitId: revisionIssue.candidateToolUnitIds[0],
      retiredToolUnitId: revisionIssue.candidateToolUnitIds[1],
      expectedSurvivorRevision: revisionIssue.candidateRevisions[0],
      expectedRetiredRevision: revisionIssue.candidateRevisions[1],
      expectedSurvivorHolder: revisionIssue.candidateHolders[0],
      expectedRetiredHolder: revisionIssue.candidateHolders[1],
    };
    const revisionTransfer = await revisionApi.custody.startTransfer({
      actorId: 'ray-torres',
      toolUnitId: mergeArgs.survivorToolUnitId,
      to: { type: 'worker', userId: 'avery-cole' },
    });
    const revisionReceipt = await revisionApi.custody.acceptTransfer({
      actorId: 'avery-cole',
      handoffId: revisionTransfer.handoffId!,
      toolUnitId: mergeArgs.survivorToolUnitId,
    });
    const beforeRevision = revisionDatabase.read();
    expect(beforeRevision.events.at(-1)?.id).toBe(revisionReceipt.eventId);
    await expect(revisionApi.reconciliation.mergeDuplicate({ actorId: 'sam-ochoa', ...mergeArgs })).rejects.toThrow(
      'Tool records changed',
    );
    expect(revisionDatabase.read()).toEqual(beforeRevision);

    const holderDatabase = createMockDatabase();
    const holderApi = createMockApi(holderDatabase);
    const holderIssue = await duplicateInput(holderApi);
    const holderArgs = {
      issueId: holderIssue.id,
      expectedIssueRevision: holderIssue.revision,
      survivorToolUnitId: holderIssue.candidateToolUnitIds[0],
      retiredToolUnitId: holderIssue.candidateToolUnitIds[1],
      expectedSurvivorRevision: holderIssue.candidateRevisions[0],
      expectedRetiredRevision: holderIssue.candidateRevisions[1],
      expectedSurvivorHolder: holderIssue.candidateHolders[0],
      expectedRetiredHolder: holderIssue.candidateHolders[1],
    };
    const holderTransfer = await holderApi.custody.startTransfer({
      actorId: 'ray-torres',
      toolUnitId: holderArgs.survivorToolUnitId,
      to: { type: 'worker', userId: 'avery-cole' },
    });
    const holderReceipt = await holderApi.custody.acceptTransfer({
      actorId: 'avery-cole',
      handoffId: holderTransfer.handoffId!,
      toolUnitId: holderArgs.survivorToolUnitId,
    });
    const beforeHolder = holderDatabase.read();
    const currentHolderRevision = beforeHolder.units.find(
      (unit) => unit.id === holderArgs.survivorToolUnitId,
    )?.revision;
    if (currentHolderRevision === undefined) throw new Error('missing transitioned holder revision');
    expect(beforeHolder.events.at(-1)?.id).toBe(holderReceipt.eventId);
    await expect(
      holderApi.reconciliation.mergeDuplicate({
        actorId: 'sam-ochoa',
        ...holderArgs,
        expectedSurvivorRevision: currentHolderRevision,
      }),
    ).rejects.toThrow('Custody changed');
    expect(holderDatabase.read()).toEqual(beforeHolder);

    const wrongCandidateDatabase = createMockDatabase();
    const wrongCandidateApi = createMockApi(wrongCandidateDatabase);
    const wrongCandidateIssue = await duplicateInput(wrongCandidateApi);
    const beforeWrongCandidate = wrongCandidateDatabase.read();
    await expect(
      wrongCandidateApi.reconciliation.mergeDuplicate({
        actorId: 'sam-ochoa',
        issueId: wrongCandidateIssue.id,
        expectedIssueRevision: wrongCandidateIssue.revision,
        survivorToolUnitId: 'TL-104',
        retiredToolUnitId: wrongCandidateIssue.candidateToolUnitIds[1],
        expectedSurvivorRevision: 1,
        expectedRetiredRevision: wrongCandidateIssue.candidateRevisions[1],
        expectedSurvivorHolder: wrongCandidateIssue.candidateHolders[0],
        expectedRetiredHolder: wrongCandidateIssue.candidateHolders[1],
      }),
    ).rejects.toThrow('candidates do not match');
    expect(wrongCandidateDatabase.read()).toEqual(beforeWrongCandidate);

    const mismatchDatabase = createMockDatabase();
    const mismatchApi = createMockApi(mismatchDatabase);
    const mismatchIssue = (await mismatchApi.reconciliation.listIssues({ actorId: 'sam-ochoa' })).issues.find(
      (candidate) => candidate.kind === 'custody-mismatch',
    );
    if (!mismatchIssue || mismatchIssue.kind !== 'custody-mismatch') throw new Error('missing mismatch fixture');
    const mismatchState = mismatchDatabase.read();
    const mismatchUnit = mismatchState.units.find((unit) => unit.id === mismatchIssue.toolUnitId);
    const mismatchDefinition = mismatchState.definitions.find(
      (definition) => definition.id === mismatchUnit?.definitionId,
    );
    if (!mismatchUnit || !mismatchDefinition) throw new Error('missing mismatch definition');
    const mismatchUpdated = await mismatchApi.tools.updateTool({
      actorId: 'sam-ochoa',
      toolUnitId: mismatchIssue.toolUnitId,
      expectedRevision: mismatchIssue.toolRevision,
      expectedStatus: 'in-stock',
      expectedHolder: mismatchIssue.recordedHolder,
      definition: {
        name: mismatchDefinition.name,
        brand: mismatchDefinition.brand,
        model: mismatchDefinition.model,
        categoryId: mismatchDefinition.categoryId,
        imageKey: mismatchDefinition.imageKey,
      },
    });
    const beforeMismatch = mismatchDatabase.read();
    expect(mismatchUpdated.revision).toBe(mismatchIssue.toolRevision + 1);
    expect(beforeMismatch.events.at(-1)?.action).toBe('Edited ' + mismatchDefinition.name);
    await expect(
      mismatchApi.reconciliation.resolveCustodyMismatch({
        actorId: 'sam-ochoa',
        issueId: mismatchIssue.id,
        expectedIssueRevision: mismatchIssue.revision,
        toolUnitId: mismatchIssue.toolUnitId,
        expectedToolRevision: mismatchIssue.toolRevision,
        expectedRecordedHolder: mismatchIssue.recordedHolder,
        decision: 'accept-observed',
      }),
    ).rejects.toThrow('Recorded custody changed');
    expect(mismatchDatabase.read()).toEqual(beforeMismatch);
  });

  it('rejects archived mismatch targets without changing custody, issue, or events', async () => {
    for (const decision of ['accept-observed', 'keep-recorded'] as const) {
      const database = createMockDatabase();
      const api = createMockApi(database);
      const issue = (await api.reconciliation.listIssues({ actorId: 'sam-ochoa' })).issues.find(
        (candidate) => candidate.kind === 'custody-mismatch',
      );
      if (!issue || issue.kind !== 'custody-mismatch') throw new Error('missing mismatch fixture');
      const archivedReceipt = await api.warehouse.decommissionTool({
        actorId: 'sam-ochoa',
        toolUnitId: issue.toolUnitId,
        expectedRevision: issue.toolRevision,
      });
      const before = database.read();
      expect(before.units.find((unit) => unit.id === issue.toolUnitId)?.lifecycle).toBe('archived');
      expect(before.events.at(-1)?.id).toBe(archivedReceipt.eventId);
      await expect(
        api.reconciliation.resolveCustodyMismatch({
          actorId: 'sam-ochoa',
          issueId: issue.id,
          expectedIssueRevision: issue.revision,
          toolUnitId: issue.toolUnitId,
          expectedToolRevision: issue.toolRevision,
          expectedRecordedHolder: issue.recordedHolder,
          decision,
        }),
      ).rejects.toThrow('archived');
      expect(database.read()).toEqual(before);
    }
  });

  it('rejects mismatch resolution while a handoff is pending without changing state', async () => {
    const database = createMockDatabase();
    const api = createMockApi(database);
    const issue = (await api.reconciliation.listIssues({ actorId: 'sam-ochoa' })).issues.find(
      (candidate) => candidate.kind === 'custody-mismatch',
    );
    if (!issue || issue.kind !== 'custody-mismatch') throw new Error('missing mismatch fixture');
    await api.custody.requestTool({ actorId: 'ray-torres', toolUnitId: issue.toolUnitId });
    const before = database.read();
    await expect(
      api.reconciliation.resolveCustodyMismatch({
        actorId: 'sam-ochoa',
        issueId: issue.id,
        expectedIssueRevision: issue.revision,
        toolUnitId: issue.toolUnitId,
        expectedToolRevision: issue.toolRevision,
        expectedRecordedHolder: issue.recordedHolder,
        decision: 'accept-observed',
      }),
    ).rejects.toThrow('pending handoff');
    expect(database.read()).toEqual(before);
  });
});
