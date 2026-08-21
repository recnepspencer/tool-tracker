import type { ReconciliationIssueView } from '../reconciliation';

export interface ReconciliationBoardView {
  issues: ReconciliationIssueView[];
  openCount: number;
  resolvedCount: number;
}
