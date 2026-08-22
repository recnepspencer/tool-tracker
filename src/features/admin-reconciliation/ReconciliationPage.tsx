import { ErrorState, LoadingState } from '../../components/ui/AsyncState';
import { PageHeading } from '../../components/layout/PageHeading';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { ReconciliationIssueCard } from './ReconciliationIssueCard';
import { ReconciliationReviewDialog } from './ReconciliationReviewDialog';
import { useReconciliationController } from './use-reconciliation-controller';
import './admin-reconciliation.css';

export function ReconciliationPage() {
  const controller = useReconciliationController();
  if (controller.isPending) return <LoadingState label="Loading reconciliation worklist…" />;
  if (controller.isError || !controller.data)
    return (
      <ErrorState
        message="The reconciliation worklist could not be loaded."
        onRetry={() => void controller.refetch()}
      />
    );
  const duplicates = controller.data.issues.filter((issue) => issue.kind === 'duplicate-tool-record');
  const mismatches = controller.data.issues.filter((issue) => issue.kind === 'custody-mismatch');
  return (
    <div className="page-content admin-reconciliation-page">
      <PageHeading
        eyebrow="Admin view · Governance"
        title="Reconciliation"
        description={`${controller.data.openCount} records need a decision.`}
      />
      {duplicates.length ? (
        <section className="reconciliation-section">
          <div className="reconciliation-section__heading">
            <h2>Possible duplicates</h2>
            <span>{duplicates.length}</span>
          </div>
          <div className="reconciliation-list">
            {duplicates.map((issue) => (
              <ReconciliationIssueCard key={issue.id} issue={issue} onReview={controller.review} />
            ))}
          </div>
        </section>
      ) : null}
      {mismatches.length ? (
        <section className="reconciliation-section">
          <div className="reconciliation-section__heading">
            <h2>Records that need a decision</h2>
            <span>{mismatches.length}</span>
          </div>
          <div className="reconciliation-list">
            {mismatches.map((issue) => (
              <ReconciliationIssueCard key={issue.id} issue={issue} onReview={controller.review} />
            ))}
          </div>
        </section>
      ) : null}
      {!controller.data.issues.length && (
        <SurfaceCard>
          <p className="admin-empty">No reconciliation issues are recorded.</p>
        </SurfaceCard>
      )}
      <ReconciliationReviewDialog controller={controller} />
    </div>
  );
}
