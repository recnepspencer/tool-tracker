import { useActivityPageState } from './settings-state';
import { errorMessage } from './client';
import { Link } from 'react-router-dom';
import { activityTitle } from './activity-presentation';
import { date, Empty, Field, Loading, Notice } from './ui';

export function ActivityPage() {
  const { c, offset, setOffset, activity, search, kind, warehouse, mine, warehouses, update } = useActivityPageState();
  return (
    <div className="activity-page">
      <header className="page-heading">
        <div>
          <h1>Activity</h1>
          <p>
            {c.can('activity.read') ? 'Company activity' : 'Your activity'}. Changes to tools, custody, and team
            assignments.
          </p>
        </div>
      </header>
      <div className="toolbar">
        <Field
          label="Search activity"
          type="search"
          value={search}
          onChange={(event) => update('search', event.target.value)}
        />
        <div className="field">
          <label htmlFor="activity-warehouse">Warehouse</label>
          <select
            id="activity-warehouse"
            value={warehouse}
            onChange={(event) => update('warehouse', event.target.value)}
          >
            <option value="">All warehouses</option>
            {warehouses.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="view-controls" role="group" aria-label="Activity type">
        {[
          ['all', 'Everything'],
          ['custody', 'Custody'],
          ['request', 'Requests'],
          ['flag', 'Damage & loss'],
          ['admin', 'Admin'],
        ].map(([value, label]) => (
          <button
            key={value}
            aria-pressed={kind === value}
            onClick={() => update('kind', value === 'all' ? '' : value)}
          >
            {label}
          </button>
        ))}
      </div>
      {c.can('activity.read') && (
        <label className="check">
          <input
            type="checkbox"
            checked={mine}
            onChange={(event) => update('mine', event.target.checked ? 'true' : '')}
          />
          Only my activity
        </label>
      )}
      {activity.isPending && <Loading />}
      {(activity.error || warehouses.error) && (
        <Notice error>{errorMessage(activity.error || warehouses.error)}</Notice>
      )}
      <div className="activity-feed">
        {activity.data?.items.map((item) => (
          <article className="activity-entry panel" key={item.id}>
            <strong>{activityTitle(item.event_key)}</strong>
            <p>
              {item.effective_name ?? 'System'} · {date(item.occurred_at)}
            </p>
            {typeof item.metadata.asset_tag === 'string' &&
              (c.can('tools.read') && typeof item.metadata.asset_id === 'string' ? (
                <Link to={`/app/tools/${item.metadata.asset_id}`}>{item.metadata.asset_tag}</Link>
              ) : (
                <p>{item.metadata.asset_tag}</p>
              ))}
            {typeof item.metadata.reason === 'string' && <p>{item.metadata.reason}</p>}
            {typeof item.metadata.note === 'string' && <p>{item.metadata.note}</p>}
          </article>
        ))}
      </div>
      {activity.data?.items.length === 0 && <Empty>No activity matches these filters.</Empty>}
      {activity.data && (
        <div className="pagination">
          <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 30))}>
            Previous
          </button>
          <button disabled={activity.data.next_offset === null} onClick={() => setOffset(activity.data.next_offset!)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
