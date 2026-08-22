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
  survivorToolUnitId = issue.candidateToolUnitIds[0],
): Omit<MergeDuplicateInput, 'actorId'> => ({
  ...(() => {
    const survivorIndex = issue.candidateToolUnitIds.indexOf(survivorToolUnitId);
    const safeSurvivorIndex = survivorIndex === -1 ? 0 : survivorIndex;
    const retiredIndex = safeSurvivorIndex === 0 ? 1 : 0;
    return {
      survivorToolUnitId: issue.candidateToolUnitIds[safeSurvivorIndex],
      retiredToolUnitId: issue.candidateToolUnitIds[retiredIndex],
      expectedSurvivorRevision: issue.candidateRevisions[safeSurvivorIndex],
      expectedRetiredRevision: issue.candidateRevisions[retiredIndex],
      expectedSurvivorHolder: issue.candidateHolders[safeSurvivorIndex],
      expectedRetiredHolder: issue.candidateHolders[retiredIndex],
    };
  })(),
  issueId: issue.id,
  expectedIssueRevision: issue.revision,
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
