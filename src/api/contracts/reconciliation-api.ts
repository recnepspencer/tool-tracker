import type { HolderRef } from '../../domain/custody';
import type { ReconciliationBoardView } from '../../domain/read-models/reconciliation';
import type { ReconciliationReceipt } from '../../domain/reconciliation';

export interface ReconciliationActorInput {
  actorId: string;
}

export interface DismissDuplicateInput extends ReconciliationActorInput {
  issueId: string;
  expectedIssueRevision: number;
  note?: string;
}

export interface MergeDuplicateInput extends ReconciliationActorInput {
  issueId: string;
  expectedIssueRevision: number;
  survivorToolUnitId: string;
  retiredToolUnitId: string;
  expectedSurvivorRevision: number;
  expectedRetiredRevision: number;
  expectedSurvivorHolder: HolderRef;
  expectedRetiredHolder: HolderRef;
  note?: string;
}

export interface ResolveCustodyMismatchInput extends ReconciliationActorInput {
  issueId: string;
  expectedIssueRevision: number;
  toolUnitId: string;
  expectedToolRevision: number;
  expectedRecordedHolder: HolderRef;
  decision: 'keep-recorded' | 'accept-observed';
  note?: string;
}

export interface ReconciliationApi {
  listIssues(input: ReconciliationActorInput): Promise<ReconciliationBoardView>;
  dismissDuplicate(input: DismissDuplicateInput): Promise<ReconciliationReceipt>;
  mergeDuplicate(input: MergeDuplicateInput): Promise<ReconciliationReceipt>;
  resolveCustodyMismatch(input: ResolveCustodyMismatchInput): Promise<ReconciliationReceipt>;
}
