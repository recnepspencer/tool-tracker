import type { ReconciliationBoardView } from '../../domain/read-models/reconciliation';
import type { ReconciliationIssueView, ReconciliationReceipt } from '../../domain/reconciliation';
import { sameHolder } from '../../domain/custody-policy';
import { mapHolder } from './http-holder-mapper';
import type {
  ReconciliationIssueDto,
  ReconciliationReceiptDto,
  ReconciliationResponseDto,
} from './http-reconciliation-types';
import { compareActivityTimestamps } from '../../domain/activity';
import { assertUniqueIds } from './http-transport';
import {
  arrayValue,
  instantValue,
  nonBlankStringValue,
  nonNegativeIntegerValue,
  oneOf,
  positiveIntegerValue,
} from './http-validation';

export const mapReconciliation = (dto: ReconciliationResponseDto): ReconciliationBoardView => {
  const mappedIssues = arrayValue<ReconciliationIssueDto>(dto.issues, 'reconciliation issues').map(
    mapReconciliationIssue,
  );
  const issues = assertUniqueIds(
    mappedIssues.sort(
      (left, right) => compareActivityTimestamps(left.detectedAt, right.detectedAt) || left.id.localeCompare(right.id),
    ),
    'reconciliation issues',
  );
  const openCount = nonNegativeIntegerValue(dto.open_count, 'open reconciliation count');
  const resolvedCount = nonNegativeIntegerValue(dto.resolved_count, 'resolved reconciliation count');
  const actualOpenCount = issues.filter((issue) => issue.status === 'open').length;
  const actualResolvedCount = issues.length - actualOpenCount;
  if (openCount !== actualOpenCount || resolvedCount !== actualResolvedCount) {
    throw new Error('Invalid API response: reconciliation aggregate counts');
  }
  return { issues: issues.filter((issue) => issue.status === 'open'), openCount, resolvedCount };
};

type BaseIssue = {
  id: string;
  reason: string;
  detectedAt: string;
  revision: number;
  status: 'open' | 'resolved';
};

const mapBaseIssue = (issue: ReconciliationIssueDto): BaseIssue => ({
  id: nonBlankStringValue(issue.issue_id, 'reconciliation issue id'),
  reason: nonBlankStringValue(issue.reason, 'reconciliation reason'),
  detectedAt: instantValue(issue.detected_at, 'reconciliation detection time'),
  revision: positiveIntegerValue(issue.revision, 'reconciliation revision'),
  status: oneOf(issue.status, ['open', 'resolved'] as const, 'reconciliation status'),
});

const mapDuplicateIssue = (
  issue: ReconciliationIssueDto,
  base: BaseIssue,
): Extract<ReconciliationIssueView, { kind: 'duplicate-tool-record' }> => {
  if (!issue.candidate_tool_unit_ids || issue.candidate_tool_unit_ids.length !== 2) {
    throw new Error('Invalid API response: duplicate candidates');
  }
  const candidateToolUnitIds = issue.candidate_tool_unit_ids.map((id, index) =>
    nonBlankStringValue(id, 'duplicate candidate id ' + index),
  ) as [string, string];
  if (candidateToolUnitIds[0] === candidateToolUnitIds[1])
    throw new Error('Invalid API response: duplicate candidates');
  if (issue.candidate_names && issue.candidate_names.length !== 2)
    throw new Error('Invalid API response: duplicate candidate names');
  const names = (issue.candidate_names?.map((name) => nonBlankStringValue(name, 'duplicate candidate name')) ??
    candidateToolUnitIds) as [string, string];
  if (!issue.candidate_holders || issue.candidate_holders.length !== 2)
    throw new Error('Invalid API response: duplicate holders');
  if (!issue.candidate_revisions || issue.candidate_revisions.length !== 2)
    throw new Error('Invalid API response: duplicate revisions');
  const revisions = [
    positiveIntegerValue(issue.candidate_revisions[0], 'duplicate first revision'),
    positiveIntegerValue(issue.candidate_revisions[1], 'duplicate second revision'),
  ] as [number, number];
  return {
    ...base,
    kind: 'duplicate-tool-record',
    candidateToolUnitIds,
    candidateNames: [
      candidateDisplayName(names[0], candidateToolUnitIds[0]),
      candidateDisplayName(names[1], candidateToolUnitIds[1]),
    ],
    candidateRevisions: revisions,
    candidateHolders: [
      holderRef(mapHolder(issue.candidate_holders[0], 'duplicate first')),
      holderRef(mapHolder(issue.candidate_holders[1], 'duplicate second')),
    ],
  };
};

const mapCustodyMismatchIssue = (
  issue: ReconciliationIssueDto,
  base: BaseIssue,
): Extract<ReconciliationIssueView, { kind: 'custody-mismatch' }> => {
  if (!issue.tool_unit_id || !issue.recorded_holder || !issue.observed_holder || !issue.tool_name)
    throw new Error('Invalid API response: custody mismatch');
  const recordedHolder = holderRef(mapHolder(issue.recorded_holder, 'recorded'));
  const observedHolder = holderRef(mapHolder(issue.observed_holder, 'observed'));
  if (sameHolder(recordedHolder, observedHolder)) {
    throw new Error('Invalid API response: custody mismatch holders must differ');
  }
  return {
    ...base,
    kind: 'custody-mismatch',
    toolUnitId: nonBlankStringValue(issue.tool_unit_id, 'mismatch tool id'),
    recordedHolder,
    observedHolder,
    toolName: nonBlankStringValue(issue.tool_name, 'mismatch tool name'),
    recordedLabel: nonBlankStringValue(issue.recorded_label, 'recorded holder'),
    observedLabel: nonBlankStringValue(issue.observed_label, 'observed holder'),
    toolRevision: positiveIntegerValue(issue.tool_revision, 'mismatch tool revision'),
  };
};

const mapReconciliationIssue = (issue: ReconciliationIssueDto): ReconciliationIssueView => {
  const base = mapBaseIssue(issue);
  const kind = oneOf(issue.kind, ['duplicate-tool-record', 'custody-mismatch'] as const, 'reconciliation kind');
  return kind === 'duplicate-tool-record' ? mapDuplicateIssue(issue, base) : mapCustodyMismatchIssue(issue, base);
};

const candidateDisplayName = (name: string, unitId: string) =>
  name.endsWith(' · ' + unitId) ? name : name + ' · ' + unitId;

const holderRef = (holder: ReturnType<typeof mapHolder>) =>
  holder.type === 'worker'
    ? { type: 'worker' as const, userId: holder.userId }
    : { type: 'warehouse' as const, warehouseId: holder.warehouseId };

export const mapReconciliationReceipt = (
  dto: ReconciliationReceiptDto,
  expected: {
    operation: ReconciliationReceipt['operation'];
    issueId: string;
    affectedToolUnitIds: readonly string[];
  },
): ReconciliationReceipt => {
  const eventId = nonBlankStringValue(dto.event_id, 'reconciliation event id');
  const correlationId = nonBlankStringValue(dto.correlation_id, 'reconciliation correlation');
  if (correlationId !== 'REC-' + eventId || dto.operation !== expected.operation)
    throw new Error('Invalid API response: reconciliation receipt');
  const ids = arrayValue<string>(dto.affected_tool_unit_ids, 'reconciliation tools').map((id) =>
    nonBlankStringValue(id, 'reconciliation tool id'),
  );
  if (new Set(ids).size !== ids.length) throw new Error('Invalid API response: reconciliation tool ids');
  if (
    dto.issue_id !== expected.issueId ||
    ids.slice().sort().join('|') !== [...expected.affectedToolUnitIds].sort().join('|')
  ) {
    throw new Error('Invalid API response: reconciliation receipt references');
  }
  return {
    operation: expected.operation,
    correlationId,
    eventId,
    issueId: nonBlankStringValue(dto.issue_id, 'reconciliation issue id'),
    affectedToolUnitIds: ids,
  };
};
