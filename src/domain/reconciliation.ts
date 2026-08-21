import type { HolderRef } from './custody';

export const RECONCILIATION_ISSUE_KINDS = ['duplicate-tool-record', 'custody-mismatch'] as const;
export type ReconciliationIssueKind = (typeof RECONCILIATION_ISSUE_KINDS)[number];

export const RECONCILIATION_STATUSES = ['open', 'resolved'] as const;
export type ReconciliationStatus = (typeof RECONCILIATION_STATUSES)[number];

export interface DuplicateToolIssue {
  id: string;
  kind: 'duplicate-tool-record';
  candidateToolUnitIds: [string, string];
  reason: string;
  detectedAt: string;
  revision: number;
  status: ReconciliationStatus;
  resolution?: {
    type: 'dismissed' | 'merged';
    actorId: string;
    resolvedAt: string;
    note?: string;
    survivorToolUnitId?: string;
    retiredToolUnitId?: string;
  };
}

export interface CustodyMismatchIssue {
  id: string;
  kind: 'custody-mismatch';
  toolUnitId: string;
  recordedHolder: HolderRef;
  observedHolder: HolderRef;
  reason: string;
  detectedAt: string;
  revision: number;
  status: ReconciliationStatus;
  resolution?: { type: 'keep-recorded' | 'accept-observed'; actorId: string; resolvedAt: string; note?: string };
}

export type ReconciliationIssue = DuplicateToolIssue | CustodyMismatchIssue;

export type ReconciliationIssueView =
  | (DuplicateToolIssue & {
      candidateNames: [string, string];
      candidateRevisions: [number, number];
      candidateHolders: [HolderRef, HolderRef];
    })
  | (CustodyMismatchIssue & { toolName: string; recordedLabel: string; observedLabel: string; toolRevision: number });

export interface ReconciliationReceipt {
  operation: 'dismiss-duplicate' | 'merge-duplicate' | 'resolve-custody-mismatch';
  correlationId: string;
  eventId: string;
  issueId: string;
  affectedToolUnitIds: string[];
}
