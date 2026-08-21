import type {
  DismissDuplicateInput,
  MergeDuplicateInput,
  ResolveCustodyMismatchInput,
} from '../../api/contracts/reconciliation-api';
import type { ReconciliationIssueView } from '../../domain/reconciliation';

const optionalNote = (note: string) => (note.trim() ? note.trim() : undefined);

export const dismissInput = (
  issue: Extract<ReconciliationIssueView, { kind: 'duplicate-tool-record' }>,
  note: string,
): Omit<DismissDuplicateInput, 'actorId'> => ({
  issueId: issue.id,
  expectedIssueRevision: issue.revision,
  ...(optionalNote(note) ? { note: optionalNote(note) } : {}),
});

export const mergeInput = (
  issue: Extract<ReconciliationIssueView, { kind: 'duplicate-tool-record' }>,
  note: string,
): Omit<MergeDuplicateInput, 'actorId'> => ({
  issueId: issue.id,
  expectedIssueRevision: issue.revision,
  survivorToolUnitId: issue.candidateToolUnitIds[0],
  retiredToolUnitId: issue.candidateToolUnitIds[1],
  expectedSurvivorRevision: issue.candidateRevisions[0],
  expectedRetiredRevision: issue.candidateRevisions[1],
  expectedSurvivorHolder: issue.candidateHolders[0],
  expectedRetiredHolder: issue.candidateHolders[1],
  ...(optionalNote(note) ? { note: optionalNote(note) } : {}),
});

export const resolveMismatchInput = (
  issue: Extract<ReconciliationIssueView, { kind: 'custody-mismatch' }>,
  decision: ResolveCustodyMismatchInput['decision'],
  note: string,
): Omit<ResolveCustodyMismatchInput, 'actorId'> => ({
  issueId: issue.id,
  expectedIssueRevision: issue.revision,
  toolUnitId: issue.toolUnitId,
  expectedToolRevision: issue.toolRevision,
  expectedRecordedHolder: issue.recordedHolder,
  decision,
  ...(optionalNote(note) ? { note: optionalNote(note) } : {}),
});
