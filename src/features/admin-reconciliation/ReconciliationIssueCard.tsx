import type { ReconciliationIssueView } from '../../domain/reconciliation';
import { CustodyMismatchCard } from './CustodyMismatchCard';
import { DuplicateRecordCard } from './DuplicateRecordCard';

export function ReconciliationIssueCard({
  issue,
  onReview,
}: {
  issue: ReconciliationIssueView;
  onReview(issue: ReconciliationIssueView): void;
}) {
  return issue.kind === 'duplicate-tool-record' ? (
    <DuplicateRecordCard issue={issue} onReview={onReview} />
  ) : (
    <CustodyMismatchCard issue={issue} onReview={onReview} />
  );
}
