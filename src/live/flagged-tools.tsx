import { Link } from 'react-router-dom';
import { type FlaggedCondition, type FlaggedRowModel, useFlaggedTools } from './flagged-state';
import { formatStamp } from './format';
import {
  Button,
  DirectoryToolbar,
  ErrorState,
  LoadingState,
  PageHeading,
  SelectField,
  StatusBadge,
  SurfaceCard,
  ToolPhoto,
} from './kit';
import { BackLink } from './related-links';
import { assetLabel, photoSrc, toolStatus } from './tool-status';

const filters: { value: FlaggedCondition; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'lost', label: 'Lost' },
];

const incidentLabels = { damage: 'Damage reported', missing: 'Reported missing' } as const;

/** Demo FlaggedToolsPage over open incidents and the live tool collection. */
export function FlaggedToolsPage() {
  const page = useFlaggedTools();
  if (page.tools.isPending || page.incidents.isPending) return <LoadingState label="Loading damaged and lost tools…" />;
  if (!page.tools.data || !page.incidents.data)
    return (
      <ErrorState
        message="Damaged and lost tools could not be loaded."
        onRetry={() => void Promise.all([page.tools.refetch(), page.incidents.refetch()])}
      />
    );
  return (
    <div className="page-content admin-operations-page">
      <BackLink to="/app/operations">Queue</BackLink>
      <PageHeading title="Damaged & lost" description="Review flagged tools and decide what happens next." />
      <DirectoryToolbar<FlaggedCondition>
        searchLabel="Search damaged and lost tools"
        searchPlaceholder="Search tools…"
        search={page.search}
        onSearchChange={page.setSearch}
        filterLabel="Condition filter"
        filters={filters}
        activeFilter={page.condition}
        onFilterChange={page.setCondition}
        trailing={
          <SelectField
            compact
            hideLabel
            searchable={false}
            label="Warehouse"
            value={page.warehouse || 'all'}
            onChange={page.setWarehouse}
            options={page.warehouseOptions}
          />
        }
      />
      {(page.tools.isError || page.incidents.isError) && (
        <ErrorState
          message="Damaged and lost tools could not be refreshed."
          onRetry={() => void Promise.all([page.tools.refetch(), page.incidents.refetch()])}
        />
      )}
      <SurfaceCard className="inventory-card flagged-card">
        {page.rows.length ? (
          <div className="flagged-list">
            <div className="flagged-list__header" aria-hidden="true">
              <span>Tool</span>
              <span>Issue</span>
              <span>Current custody</span>
              <span>Actions</span>
            </div>
            {page.rows.map((row) => (
              <FlaggedRow key={row.asset.id} row={row} companyId={page.c.company_id} returnTo={page.returnTo} />
            ))}
          </div>
        ) : (
          <p className="admin-empty">No damaged or lost tools match this view.</p>
        )}
      </SurfaceCard>
    </div>
  );
}

function FlaggedRow({ row, companyId, returnTo }: { row: FlaggedRowModel; companyId: string; returnTo: string }) {
  const { asset, incidents, policy } = row;
  const latest = incidents.at(-1);
  const to = (action: string) => ({ pathname: `/app/flagged/${asset.id}`, search: `?action=${action}` });
  const state = { returnTo };
  return (
    <article className="flagged-row">
      <div className="flagged-row__main">
        <ToolPhoto src={photoSrc(companyId, asset.registration_photo_id)} alt="" size="small" priority />
        <div className="flagged-row__body">
          <h2>{asset.name}</h2>
          <span className="flagged-row__identity">
            {asset.asset_tag} · {asset.category_name}
          </span>
          {latest && (
            <>
              <span className="flagged-row__identity">
                {incidentLabels[latest.kind]} by {latest.reported_by_name} · {formatStamp(latest.reported_at)}
              </span>
              {latest.description && <span className="queue-item__note">“{latest.description}”</span>}
            </>
          )}
        </div>
      </div>
      <div className="flagged-row__issue">
        <StatusBadge tone={toolStatus(asset)}>{assetLabel(asset)}</StatusBadge>
      </div>
      <div className="flagged-row__custody">
        <strong>{asset.holder_name ?? asset.warehouse_name ?? 'No current custodian'}</strong>
        <span>
          {asset.holder_membership_id ? `Home warehouse · ${asset.responsible_warehouse_name}` : 'Warehouse custody'}
        </span>
      </div>
      <div className="flagged-row__actions">
        <ActionLink variant="ghost" enabled={policy.canEdit} to={to('edit')} state={state}>
          Edit
        </ActionLink>
        {policy.canRestore || policy.canDecommission ? (
          <>
            <ActionLink enabled={policy.canRestore} to={to('restore')} state={state} label="Restore to stock">
              Restore
            </ActionLink>
            <ActionLink variant="danger" enabled={policy.canDecommission} to={to('lifecycle')} state={state}>
              Decommission
            </ActionLink>
          </>
        ) : (
          <ActionLink enabled={policy.canForceReturn} to={to('transfer')} state={state}>
            Force return
          </ActionLink>
        )}
      </div>
    </article>
  );
}

/** A Button-styled link into the tool drawer; rendered as a disabled button when the action is not allowed. */
function ActionLink({
  enabled,
  to,
  state,
  variant = 'primary',
  label,
  children,
}: {
  enabled: boolean;
  to: { pathname: string; search: string };
  state: { returnTo: string };
  variant?: 'primary' | 'ghost' | 'danger';
  label?: string;
  children: string;
}) {
  const className = `button button--${variant}`;
  if (!enabled)
    return (
      <Button variant={variant} disabled aria-label={label}>
        {children}
      </Button>
    );
  return (
    <Link className={className} to={to} state={state} aria-label={label}>
      {children}
    </Link>
  );
}
