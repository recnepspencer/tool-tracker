import type { MergeDuplicateInput, ResolveCustodyMismatchInput } from '../contracts/reconciliation-api';
import type { CustodyMismatchIssue, DuplicateToolIssue } from '../../domain/reconciliation';
import { sameHolder } from '../../domain/custody-policy';
import { WorkflowError } from '../../domain/workflow-error';
import type { MockDatabaseState } from './seed-state';
import { pendingForUnit } from './custody-record-state';

const unitOrThrow = (state: MockDatabaseState, id: string) => {
  const unit = state.units.find((candidate) => candidate.id === id);
  if (!unit) throw new WorkflowError('not-found', 'Tool unit not found: ' + id);
  return unit;
};

const holderOrThrow = (state: MockDatabaseState, id: string) => {
  const holder = state.custody.find((record) => record.toolUnitId === id);
  if (!holder) throw new WorkflowError('invalid', 'Custody record is missing: ' + id);
  return holder;
};

export const mergeContext = (state: MockDatabaseState, issue: DuplicateToolIssue, input: MergeDuplicateInput) => {
  if (
    !issue.candidateToolUnitIds.includes(input.survivorToolUnitId) ||
    !issue.candidateToolUnitIds.includes(input.retiredToolUnitId) ||
    input.survivorToolUnitId === input.retiredToolUnitId
  ) {
    throw new WorkflowError('invalid', 'Merge candidates do not match the open issue');
  }
  const survivor = unitOrThrow(state, input.survivorToolUnitId);
  const retired = unitOrThrow(state, input.retiredToolUnitId);
  if (survivor.lifecycle !== 'active' || retired.lifecycle !== 'active')
    throw new WorkflowError('conflict', 'Archived tools cannot be merged');
  if (
    (survivor.revision ?? 1) !== input.expectedSurvivorRevision ||
    (retired.revision ?? 1) !== input.expectedRetiredRevision
  )
    throw new WorkflowError('conflict', 'Tool records changed; refresh before merging');
  const survivorCustody = holderOrThrow(state, survivor.id);
  const retiredCustody = holderOrThrow(state, retired.id);
  if (
    !sameHolder(survivorCustody.holder, input.expectedSurvivorHolder) ||
    !sameHolder(retiredCustody.holder, input.expectedRetiredHolder)
  )
    throw new WorkflowError('conflict', 'Custody changed; refresh before merging');
  if (survivor.definitionId !== retired.definitionId || !sameHolder(survivorCustody.holder, retiredCustody.holder))
    throw new WorkflowError('conflict', 'Only matching physical records can be merged');
  if (
    state.handoffs.some(
      (handoff) => handoff.status === 'pending' && [survivor.id, retired.id].includes(handoff.toolUnitId),
    )
  )
    throw new WorkflowError('conflict', 'Pending handoffs must be resolved first');
  return { survivor, retired, survivorCustody };
};

export const mismatchContext = (
  state: MockDatabaseState,
  issue: CustodyMismatchIssue,
  input: ResolveCustodyMismatchInput,
) => {
  if (issue.revision !== input.expectedIssueRevision || issue.toolUnitId !== input.toolUnitId)
    throw new WorkflowError('conflict', 'The custody mismatch changed; refresh before resolving');
  const unit = unitOrThrow(state, input.toolUnitId);
  if (unit.lifecycle !== 'active') throw new WorkflowError('archived', 'Tool unit is archived: ' + unit.id);
  if (pendingForUnit(state, unit.id)) {
    throw new WorkflowError('conflict', 'Resolve the pending handoff before reconciling this tool');
  }
  const custody = holderOrThrow(state, unit.id);
  if (
    (unit.revision ?? 1) !== input.expectedToolRevision ||
    !sameHolder(custody.holder, input.expectedRecordedHolder) ||
    !sameHolder(custody.holder, issue.recordedHolder)
  )
    throw new WorkflowError('conflict', 'Recorded custody changed; refresh before resolving');
  return { unit, custody };
};

export const assertObservedHolder = (state: MockDatabaseState, issue: CustodyMismatchIssue) => {
  const observed = issue.observedHolder;
  if (observed.type === 'worker') {
    const worker = state.users.find((user) => user.id === observed.userId);
    if (!worker || worker.role !== 'worker' || worker.lifecycle !== 'active')
      throw new WorkflowError('invalid', 'Observed worker is not active');
  } else if (!state.warehouses.some((warehouse) => warehouse.id === observed.warehouseId)) {
    throw new WorkflowError('invalid', 'Observed warehouse was not found');
  }
};
