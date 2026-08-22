import { LoadingState, ErrorState } from '../../components/ui/AsyncState';
import { MetricCard } from '../../components/ui/MetricCard';
import { MetricGrid } from '../../components/layout/MetricGrid';
import { PageHeading } from '../../components/layout/PageHeading';
import { WarehouseCoverage } from './WarehouseCoverage';
import { RecentActivity } from './RecentActivity';
import { LongHeldTools } from './LongHeldTools';
import { useAdminSummary } from './use-admin-summary';
import './admin-dashboard.css';
import { Link } from 'react-router-dom';
import { useCompanyProfile } from '../settings/use-company-profile';

export function AdminDashboardPage() {
  const summary = useAdminSummary();
  const company = useCompanyProfile();
  if (summary.isPending) return <LoadingState label="Loading the control room…" />;
  if (summary.isError || !summary.data)
    return <ErrorState message="The admin dashboard could not be loaded." onRetry={() => void summary.refetch()} />;
  const data = summary.data;

  return (
    <div className="page-content">
      <PageHeading
        eyebrow={`Admin view · ${company.data?.name ?? 'Nelson Electric'}`}
        title="Control room"
        description="A single operational picture of tools, people, and custody across every yard."
      />
      <MetricGrid columns={4}>
        <MetricCard label="Tools tracked" value={data.totalTools} detail="all yards" tone="blue" />
        <MetricCard label="Checked out" value={data.checkedOut} detail="with the crew" />
        <MetricCard label="In stock" value={data.inStock} detail="ready to request" tone="green" />
        <MetricCard
          label="Flagged"
          value={data.flagged}
          detail="needs review"
          tone={data.flagged ? 'amber' : 'default'}
        />
      </MetricGrid>
      <div className="dashboard-grid">
        <WarehouseCoverage warehouses={data.warehouses} />
        <div>
          <RecentActivity events={data.recentEvents} />
          <Link className="text-link" to="/admin/activity">
            View full audit log
          </Link>
        </div>
      </div>
      <div className="admin-attention-grid">
        <section className="admin-attention-card">
          <span className="eyebrow">Pending approvals</span>
          <strong>{data.pendingApprovals}</strong>
          <p>Handoffs waiting for a decision.</p>
        </section>
        <section className="admin-attention-card">
          <span className="eyebrow">Long-held tools</span>
          <strong>{data.longHeldTools.length}</strong>
          <p>Worker custody older than seven days.</p>
        </section>
      </div>
      <LongHeldTools tools={data.longHeldTools} />
    </div>
  );
}
