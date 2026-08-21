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
  return (
    <div className="page-content admin-reconciliation-page">
      <PageHeading
        eyebrow="Admin view · Governance"
        title="Reconciliation"
        description="Resolve duplicate records and custody observations without rewriting history."
        status={`${controller.data.openCount} open`}
      />
      <div className="reconciliation-grid">
        {controller.data.issues.map((issue) => (
          <ReconciliationIssueCard key={issue.id} issue={issue} onReview={controller.review} />
        ))}
      </div>
      {!controller.data.issues.length && (
        <SurfaceCard>
          <p className="admin-empty">No reconciliation issues are recorded.</p>
        </SurfaceCard>
      )}
      <ReconciliationReviewDialog controller={controller} />
    </div>
  );
}
