import { Link } from 'react-router-dom';
import { errorMessage } from './client';
import { useOverview } from './overview-state';
import { Loading, Notice, Section } from './ui';

export function OverviewPage() {
  const { company, summary } = useOverview();
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>Overview</h1>
          <p>{company.company_name}</p>
        </div>
      </header>
      {summary.isPending && <Loading />}
      {summary.error && <Notice error>{errorMessage(summary.error)}</Notice>}
      {summary.data && (
        <div className="summary-grid">
          {(
            [
              ['Active tools', summary.data.active_assets, '/app/tools'],
              ['Missing tools', summary.data.missing_assets, '/app/tools'],
              ['Damaged tools', summary.data.damaged_assets, '/app/tools'],
              ['Pending requests', summary.data.pending_requests, '/app/operations'],
              ['Pending handoffs', summary.data.pending_handoffs, '/app/operations'],
            ] as const
          ).map(([label, count, href]) => (
            <Link className="summary-card" key={label} to={href}>
              <span>{label}</span>
              <strong>{count}</strong>
            </Link>
          ))}
        </div>
      )}
      <Section title="Workspace">
        <div className="row">
          <div>
            <strong>Inventory and custody</strong>
            <p className="muted">Find a specific tool, request it, or confirm a handoff.</p>
          </div>
          <Link className="button" to="/app/tools">
            Open inventory
          </Link>
        </div>
        {company.can('jobs.read') && (
          <div className="row">
            <div>
              <strong>Jobs and assignments</strong>
              <p className="muted">Review your crew, responsibilities, and participation requests.</p>
            </div>
            <Link className="button" to="/app/jobs">
              Open jobs
            </Link>
          </div>
        )}
        {company.can('people.manage') && (
          <div className="row">
            <div>
              <strong>People and access</strong>
              <p className="muted">Invite teammates and manage company access.</p>
            </div>
            <Link className="button" to="/app/people">
              Manage people
            </Link>
          </div>
        )}
      </Section>
    </>
  );
}
