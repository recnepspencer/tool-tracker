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
        <div>
          <span className="eyebrow">Duplicate record</span>
          <h2>{issue.reason}</h2>
        </div>
        {issue.status === 'open' && (
          <Button aria-label="Review" variant="secondary" onClick={() => onReview(issue)}>
            Review
          </Button>
        )}
      </div>
      <div className="reconciliation-comparison">
        {issue.candidateNames.map((name, index) => (
          <div key={issue.candidateToolUnitIds[index]}>
            <span className="eyebrow">Record {index + 1}</span>
            <strong>{name}</strong>
            <small>
              {issue.candidateToolUnitIds[index]} · revision {issue.candidateRevisions[index]}
            </small>
          </div>
        ))}
      </div>
      <small>Detected {formatActivityTimestamp(issue.detectedAt)}</small>
    </SurfaceCard>
  );
}
