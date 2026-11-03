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
import { caseKindLabels, useReconciliationsPage, type CaseFilter } from './reconciliation-state';
import { assetLabel, photoSrc, toolStatus } from './tool-status';

const filters: { value: CaseFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'custody_dispute', label: 'Custody' },
  { value: 'missing_asset', label: 'Missing' },
  { value: 'duplicate_asset', label: 'Duplicates' },
];

/** Open reconciliation cases in the demo's FlaggedToolsPage list pattern. */
export function ReconciliationsPage() {
  const page = useReconciliationsPage();
  if (page.cases.isPending) return <LoadingState label="Loading reconciliation cases…" />;
  if (!page.cases.data)
    return <ErrorState message="Reconciliation cases could not be loaded." onRetry={() => void page.cases.refetch()} />;
  return (
    <div className="page-content admin-operations-page">
      <PageHeading
        eyebrow="Warehouse operations"
        title="Reconciliation"
        description="Resolve custody discrepancies with a reasoned record. Open a case from an individual tool."
      />
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
                    src={photoSrc(page.c.company_id, asset?.registration_photo_id)}
                    alt=""
                    size="small"
                    priority
                  />
                  <div className="flagged-row__body">
                    <h2>{asset?.name ?? 'Tool'}</h2>
                    <span className="flagged-row__identity">
                      {asset ? `${asset.asset_tag} · ` : ''}
                      {caseKindLabels[item.kind]} · Opened {formatStamp(item.opened_at)}
                    </span>
                    {item.narrative && <span className="queue-item__note">“{item.narrative}”</span>}
                  </div>
                </div>
                <div className="flagged-row__issue">
                  {asset && <StatusBadge tone={toolStatus(asset)}>{assetLabel(asset)}</StatusBadge>}
                </div>
                <div className="flagged-row__custody">
                  <strong>{asset?.holder_name ?? asset?.warehouse_name ?? 'No current custodian'}</strong>
                  <span>
                    {!asset
                      ? 'Loading custody…'
                      : asset.holder_membership_id
                        ? `Home warehouse · ${asset.responsible_warehouse_name}`
                        : 'Warehouse custody'}
                  </span>
                </div>
                <div className="flagged-row__actions">
                  <Button disabled={!asset} onClick={() => page.openResolve(item.id)}>
                    Resolve
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="admin-empty">No open reconciliation cases match this view.</p>
        )}
      </SurfaceCard>
      {page.open?.asset && (
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
