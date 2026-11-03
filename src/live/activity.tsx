import type { ReactNode } from 'react';
import { AuditKindChips, AuditLog } from './activity-audit';
import { ActivityFilters, ActivityGroups } from './activity-feed';
import { exportAuditLog } from './activity-presentation';
import { useActivityState, type ActivityState } from './activity-state';
import { errorMessage } from './client';
import { Button, ErrorState, LoadingState, PageHeading, SearchField, SelectField } from './kit';
import './experience/activity-pagination.css';

export function ActivityPage() {
  const state = useActivityState();
  return state.control ? <AuditLogPage state={state} /> : <WorkerActivityPage state={state} />;
}

/** Demo `WorkerActivityPage`. */
function WorkerActivityPage({ state }: { state: ActivityState }) {
  const { activity, rows, filter, setFilter, warehouse, setWarehouse, warehouses, search, setSearch, open } = state;
  return (
    <div className="worker-screen worker-activity-screen">
      <div className="worker-screen-heading worker-activity-heading">
        <h1 aria-label="Movement record">Activity</h1>
        <span className="worker-activity-unread">{rows.length ? `${rows.length} events` : 'Quiet'}</span>
      </div>
      <SearchField compact label="Search activity" placeholder="Search activity…" value={search} onChange={setSearch} />
      <ActivityFilters value={filter} onChange={setFilter} />
      {filter === 'warehouse' && (
        <SelectField
          compact
          hideLabel
          searchable={false}
          label="Warehouse"
          value={warehouse}
          onChange={setWarehouse}
          options={(warehouses.data ?? []).map((item) => ({ value: item.id, label: item.name }))}
        />
      )}
      <Feed state={state} label="Loading field activity…" error="Worker activity could not be loaded.">
        {rows.length ? (
          <ActivityGroups rows={rows} onSelect={open} />
        ) : (
          <div className="activity-empty">
            <h2>No activity in this view.</h2>
            <p>Try another filter to see the shared movement record.</p>
          </div>
        )}
      </Feed>
      {activity.hasNextPage && <LoadEarlier state={state} />}
    </div>
  );
}

/** Demo `AdminActivityPage` ("Audit log"). */
function AuditLogPage({ state }: { state: ActivityState }) {
  const { c, activity, rows, search, setSearch, kind, setKind, mine, setMine, warehouse, setWarehouse, warehouses } =
    state;
  const company = c.can('activity.read');
  return (
    <div className="page-content admin-activity-page">
      <PageHeading
        eyebrow="Admin view · Governance"
        title="Audit log"
        description={
          company
            ? 'Immutable operational history across tools, people, and settings.'
            : 'Your own changes to tools, custody, and team assignments.'
        }
        action={
          <Button variant="secondary" disabled={!rows.length} onClick={() => exportAuditLog(rows)}>
            Export log
          </Button>
        }
      />
      <div className="activity-toolbar">
        <SearchField
          compact
          label="Search audit log"
          placeholder="Search activity…"
          value={search}
          onChange={setSearch}
        />
        <SelectField
          compact
          hideLabel
          searchable={false}
          label="Warehouse"
          value={warehouse || 'all'}
          onChange={setWarehouse}
          options={[
            { value: 'all', label: 'All warehouses' },
            ...(warehouses.data ?? []).map((item) => ({ value: item.id, label: item.name })),
          ]}
        />
      </div>
      <AuditKindChips kind={kind} onKindChange={setKind} mine={mine} onMineChange={company ? setMine : undefined} />
      <Feed state={state} label="Loading the audit log…" error="The audit log could not be loaded.">
        <AuditLog rows={rows} />
      </Feed>
      {activity.hasNextPage && <LoadEarlier state={state} />}
    </div>
  );
}

function Feed({
  state,
  label,
  error,
  children,
}: {
  state: ActivityState;
  label: string;
  error: string;
  children: ReactNode;
}) {
  const { activity, warehouses } = state;
  if (activity.isPending) return <LoadingState label={label} />;
  if (!activity.data)
    return <ErrorState message={`${error} ${errorMessage(activity.error)}`} onRetry={() => void activity.refetch()} />;
  return (
    <>
      {warehouses.isError && (
        <ErrorState
          message={`Warehouse names could not be loaded. ${errorMessage(warehouses.error)}`}
          onRetry={() => void warehouses.refetch()}
        />
      )}
      {children}
    </>
  );
}

/** Live-only pagination in the demo idiom: one full-width secondary button. */
function LoadEarlier({ state }: { state: ActivityState }) {
  const { activity, loadMore } = state;
  return (
    <div className="activity-pagination">
      <Button variant="secondary" fullWidth disabled={activity.isFetchingNextPage} onClick={loadMore}>
        {activity.isFetchingNextPage ? 'Loading…' : 'Load earlier activity'}
      </Button>
      {activity.isFetchNextPageError && (
        <p className="form-error" role="alert">
          {errorMessage(activity.error)}
        </p>
      )}
    </div>
  );
}
