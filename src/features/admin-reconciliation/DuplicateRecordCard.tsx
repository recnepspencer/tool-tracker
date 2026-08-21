import { Button } from '../../components/ui/Button';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { formatActivityTimestamp } from '../../domain/activity';
import type { ReconciliationIssueView } from '../../domain/reconciliation';

export function DuplicateRecordCard({
  issue,
  onReview,
}: {
  issue: Extract<ReconciliationIssueView, { kind: 'duplicate-tool-record' }>;
  onReview(issue: ReconciliationIssueView): void;
}) {
  return (
    <SurfaceCard className={`reconciliation-card reconciliation-card--${issue.status}`}>
      <div className="reconciliation-card__header">
        <span className="eyebrow">Duplicate record</span>
        <span className="admin-meta-kind">{issue.status}</span>
      </div>
      <h2>{issue.candidateNames[0]}</h2>
      <p>{issue.candidateNames[1]}</p>
      <p className="reconciliation-reason">{issue.reason}</p>
      <small>Detected {formatActivityTimestamp(issue.detectedAt)}</small>
      {issue.status === 'open' && (
        <Button variant="secondary" onClick={() => onReview(issue)}>
          Review
        </Button>
      )}
    </SurfaceCard>
  );
}
