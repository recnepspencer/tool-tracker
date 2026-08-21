import type {
  DismissDuplicateInput,
  MergeDuplicateInput,
  ResolveCustodyMismatchInput,
} from '../contracts/reconciliation-api';
import type { ReconciliationReceipt } from '../../domain/reconciliation';
import { isAdminMember } from '../../domain/people';
import { currentWarehouseForUnit } from '../../domain/warehouse-responsibility';
import { bumpUnitRevision } from './tool-state';
import { appendAuditEvent } from './audit-events';
import type { MockDatabase } from './mock-database';
import type { MockDatabaseState } from './seed-state';
import { WorkflowError } from '../../domain/workflow-error';
import { requireAdminActor } from './admin-authorization';
import { assertObservedHolder, mergeContext, mismatchContext } from './reconciliation-command-validation';

const text = (value: string | undefined, label: string) => {
  const normalized = value?.trim() ?? '';
  if (!normalized) throw new WorkflowError('invalid', label + ' is required');
  return normalized;
};

const actor = (state: MockDatabaseState, actorId: string) => {
  const member = requireAdminActor(state, actorId);
  if (!isAdminMember(member)) throw new WorkflowError('forbidden', 'Administrator access is required');
  return member;
};

const receipt = (
  operation: ReconciliationReceipt['operation'],
  eventId: string,
  issueId: string,
  affectedToolUnitIds: string[],
): ReconciliationReceipt => ({
  operation,
  correlationId: 'REC-' + eventId,
  eventId,
  issueId,
  affectedToolUnitIds: [...new Set(affectedToolUnitIds)].sort(),
});

const issueOrThrow = (state: MockDatabaseState, issueId: string) => {
  const issue = state.reconciliationIssues.find((candidate) => candidate.id === issueId);
  if (!issue) throw new WorkflowError('not-found', 'Reconciliation issue not found');
  if (issue.status !== 'open') throw new WorkflowError('conflict', 'This reconciliation issue is already resolved');
  return issue;
};

export const dismissDuplicate = (database: MockDatabase, input: DismissDuplicateInput): ReconciliationReceipt => {
  let result!: ReconciliationReceipt;
  database.update((state) => {
    actor(state, input.actorId);
    const issue = issueOrThrow(state, input.issueId);
    if (issue.kind !== 'duplicate-tool-record' || issue.revision !== input.expectedIssueRevision) {
      throw new WorkflowError('conflict', 'The duplicate issue changed; refresh before dismissing');
    }
    const occurredAt = database.clock();
    issue.status = 'resolved';
    issue.revision += 1;
    issue.resolution = {
      type: 'dismissed',
      actorId: input.actorId,
      resolvedAt: occurredAt,
      ...(input.note ? { note: text(input.note, 'Note') } : {}),
    };
    const eventId = appendAuditEvent(state, database, {
      actorId: input.actorId,
      action: 'Dismissed duplicate tool record ' + issue.id,
      kind: 'admin',
      scope: 'admin',
      participantIds: [input.actorId],
      warehouseId: state.users.find((user) => user.id === input.actorId)?.homeWarehouseId ?? state.warehouses[0].id,
      occurredAt,
      ...(input.note ? { evidence: { note: text(input.note, 'Note') } } : {}),
    });
    result = receipt('dismiss-duplicate', eventId, issue.id, []);
    return state;
  });
  return result;
};

export const mergeDuplicate = (database: MockDatabase, input: MergeDuplicateInput): ReconciliationReceipt => {
  let result!: ReconciliationReceipt;
  database.update((state) => {
    actor(state, input.actorId);
    const issue = issueOrThrow(state, input.issueId);
    if (issue.kind !== 'duplicate-tool-record' || issue.revision !== input.expectedIssueRevision) {
      throw new WorkflowError('conflict', 'The duplicate issue changed; refresh before merging');
    }
    const { survivor, retired, survivorCustody } = mergeContext(state, issue, input);
    const occurredAt = database.clock();
    bumpUnitRevision(state, survivor);
    bumpUnitRevision(state, retired);
    retired.lifecycle = 'archived';
    issue.status = 'resolved';
    issue.revision += 1;
    issue.resolution = {
      type: 'merged',
      actorId: input.actorId,
      resolvedAt: occurredAt,
      survivorToolUnitId: survivor.id,
      retiredToolUnitId: retired.id,
      ...(input.note ? { note: text(input.note, 'Note') } : {}),
    };
    const warehouseId = currentWarehouseForUnit(survivor, survivorCustody.holder);
    const eventId = appendAuditEvent(state, database, {
      actorId: input.actorId,
      action: `Merged ${retired.id} into ${survivor.id}`,
      toolUnitId: survivor.id,
      kind: 'admin',
      scope: 'admin',
      participantIds: [input.actorId],
      warehouseId,
      occurredAt,
      ...(input.note ? { evidence: { note: text(input.note, 'Note') } } : {}),
    });
    result = receipt('merge-duplicate', eventId, issue.id, [survivor.id, retired.id]);
    return state;
  });
  return result;
};

export const resolveCustodyMismatch = (
  database: MockDatabase,
  input: ResolveCustodyMismatchInput,
): ReconciliationReceipt => {
  let result!: ReconciliationReceipt;
  database.update((state) => {
    actor(state, input.actorId);
    const issue = issueOrThrow(state, input.issueId);
    if (issue.kind !== 'custody-mismatch')
      throw new WorkflowError('conflict', 'The custody mismatch changed; refresh before resolving');
    const { unit, custody } = mismatchContext(state, issue, input);
    if (input.decision === 'accept-observed') {
      assertObservedHolder(state, issue);
      custody.holder = { ...issue.observedHolder };
      custody.sinceAt = database.clock();
      if (issue.observedHolder.type === 'warehouse') unit.assignedWarehouseId = issue.observedHolder.warehouseId;
      bumpUnitRevision(state, unit);
    }
    const occurredAt = database.clock();
    issue.status = 'resolved';
    issue.revision += 1;
    issue.resolution = {
      type: input.decision,
      actorId: input.actorId,
      resolvedAt: occurredAt,
      ...(input.note ? { note: text(input.note, 'Note') } : {}),
    };
    const eventId = appendAuditEvent(state, database, {
      actorId: input.actorId,
      action:
        input.decision === 'accept-observed'
          ? `Accepted observed custody for ${unit.id}`
          : `Kept recorded custody for ${unit.id}`,
      toolUnitId: unit.id,
      kind: 'admin',
      scope: 'admin',
      participantIds: [input.actorId],
      warehouseId: currentWarehouseForUnit(unit, custody.holder),
      occurredAt,
      ...(input.note ? { evidence: { note: text(input.note, 'Note') } } : {}),
    });
    result = receipt('resolve-custody-mismatch', eventId, issue.id, [unit.id]);
    return state;
  });
  return result;
};
