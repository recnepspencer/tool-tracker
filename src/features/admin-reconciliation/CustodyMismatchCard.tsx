import { Button } from '../../components/ui/Button';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { formatActivityTimestamp } from '../../domain/activity';
import type { ReconciliationIssueView } from '../../domain/reconciliation';

export function CustodyMismatchCard({
  issue,
  onReview,
}: {
  issue: Extract<ReconciliationIssueView, { kind: 'custody-mismatch' }>;
  onReview(issue: ReconciliationIssueView): void;
}) {
  return (
    <SurfaceCard className={`reconciliation-card reconciliation-card--${issue.status}`}>
      <div className="reconciliation-card__header">
        <div>
          <span className="eyebrow">Custody mismatch</span>
          <h2>{issue.toolName}</h2>
        </div>
        {issue.status === 'open' && (
          <Button aria-label="Review" variant="secondary" onClick={() => onReview(issue)}>
            Review
          </Button>
        )}
      </div>
      <p className="reconciliation-route">
        <span>{issue.recordedLabel}</span>
        <span aria-hidden="true">→</span>
        <span>{issue.observedLabel}</span>
      </p>
      <p className="reconciliation-reason">{issue.reason}</p>
      <small>Detected {formatActivityTimestamp(issue.detectedAt)}</small>
    </SurfaceCard>
  );
}
