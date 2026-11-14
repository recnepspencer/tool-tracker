import {
  Button,
  DirectoryToolbar,
  ErrorState,
  LoadingState,
  PageHeading,
  StatusBadge,
  SurfaceCard,
  ToolPhoto,
} from './kit';
import { formatStamp } from './format';
import { ResolveCaseDialog } from './reconciliation-dialog';
import { caseKindLabels, caseProblem, useReconciliationsPage, type CaseFilter } from './reconciliation-state';
import { BackLink } from './related-links';
import { assetLabel, photoSrc, toolStatus } from './tool-status';
import './reconciliation.css';

const filters: { value: CaseFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'custody_dispute', label: 'Custody' },
  { value: 'missing_asset', label: 'Missing' },
  { value: 'duplicate_asset', label: 'Duplicates' },
];

/** Open reconciliation cases in the demo's FlaggedToolsPage list pattern, each saying what doesn't match. */
export function ReconciliationsPage() {
  const page = useReconciliationsPage();
  if (page.cases.isPending) return <LoadingState label="Loading reconciliation cases…" />;
  if (!page.cases.data)
    return <ErrorState message="Reconciliation cases could not be loaded." onRetry={() => void page.cases.refetch()} />;
  return (
    <div className="page-content admin-operations-page">
      <BackLink to="/app/operations">Queue</BackLink>
      <PageHeading title="Reconciliation">
        <p className="reconciliation-intro">
          Fix tool records that don’t match reality: who has a tool, whether it’s lost, or whether it’s registered
          twice. Open a case from the tool’s page, then settle it here.
        </p>
      </PageHeading>
      <DirectoryToolbar<CaseFilter>
        searchLabel="Search reconciliation cases"
        searchPlaceholder="Search cases…"
        search={page.search}
        onSearchChange={page.setSearch}
        filterLabel="Case filter"
        filters={filters}
        activeFilter={page.kind}
        onFilterChange={page.setKind}
      />
      {page.cases.isError && (
        <ErrorState message="Reconciliation cases could not be refreshed." onRetry={() => void page.cases.refetch()} />
      )}
      <SurfaceCard className="inventory-card flagged-card">
        {page.rows.length ? (
          <div className="flagged-list">
            <div className="flagged-list__header" aria-hidden="true">
              <span>Tool</span>
              <span>Status</span>
              <span>Current custody</span>
              <span>Actions</span>
            </div>
            {page.rows.map(({ item, asset }) => (
              <article className="flagged-row" key={item.id} aria-label={`${caseKindLabels[item.kind]} case`}>
                <div className="flagged-row__main">
                  <ToolPhoto
                    src={photoSrc(page.c.company_id, item.record.registration_photo_id)}
                    alt=""
                    size="small"
                    priority
                  />
                  <div className="flagged-row__body">
                    <h2>{item.record.name}</h2>
                    <span className="flagged-row__identity">
                      {caseKindLabels[item.kind]} · Opened {formatStamp(item.opened_at)} by {item.opened_by_name}
                    </span>
                    <span className="reconciliation-problem">{caseProblem(item)}</span>
                    {item.narrative && <span className="queue-item__note">“{item.narrative}”</span>}
                  </div>
                </div>
                <div className="flagged-row__issue">
                  {asset && <StatusBadge tone={toolStatus(asset)}>{assetLabel(asset)}</StatusBadge>}
                </div>
                <div className="flagged-row__custody">
                  <strong>{item.record.holder_name ?? 'No current custodian'}</strong>
                  <span>
                    {!asset
                      ? 'Loading custody…'
                      : asset.holder_membership_id
                        ? `Home warehouse · ${asset.responsible_warehouse_name}`
                        : 'Warehouse custody'}
                  </span>
                </div>
                <div className="flagged-row__actions">
                  <Button onClick={() => page.openResolve(item.id)}>Resolve</Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="admin-empty">No open reconciliation cases match this view.</p>
        )}
      </SurfaceCard>
      {page.open && (
        <ResolveCaseDialog
          key={page.open.item.id}
          item={page.open.item}
          asset={page.open.asset}
          people={page.refs.people.data ?? []}
          warehouses={page.refs.warehouses.data ?? []}
          onClose={() => page.openResolve('')}
        />
      )}
    </div>
  );
}
