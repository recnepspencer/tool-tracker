import { useMemo, useState } from 'react';
import { ErrorState, LoadingState } from '../../components/ui/AsyncState';
import { useSession } from '../../app/session-context';
import { WorkerToolDetailSheet } from '../tool-detail/WorkerToolDetailSheet';
import { ActivityFeed } from './ActivityFeed';
import { ActivityFilters } from './ActivityFilters';
import { filterActivity, groupActivity, type ActivityFilter } from './activity-selectors';
import { useWorkerActivity } from './use-worker-activity';
import '../../styles/activity.css';
import '../../styles/section-heading.css';

export function WorkerActivityPage() {
  const { session } = useSession();
  const activity = useWorkerActivity();
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const filtered = useMemo(
    () => filterActivity(activity.data ?? [], filter, session?.profileId ?? ''),
    [activity.data, filter, session?.profileId],
  );
  const groups = useMemo(() => groupActivity(filtered), [filtered]);

  if (!session) return null;
  if (activity.isPending) return <LoadingState label="Loading field activity…" />;
  if (activity.isError || !activity.data) return <ErrorState message="Worker activity could not be loaded." />;

  return (
    <div className="worker-screen worker-activity-screen">
      <div className="worker-screen-heading worker-activity-heading">
        <h1 aria-label="Movement record">Activity</h1>
        <span className="worker-activity-unread">{filtered.length ? `${filtered.length} events` : 'Quiet'}</span>
      </div>
      <ActivityFilters value={filter} onChange={setFilter} />
      {groups.length ? (
        <div className="activity-groups">
          {groups.map((group) => (
            <section className="activity-group" key={group.label}>
              <div className="worker-activity-day">{group.label}</div>
              <ActivityFeed events={group.items} onSelect={setSelectedToolId} />
            </section>
          ))}
        </div>
      ) : (
        <div className="activity-empty">
          <h2>No activity in this view.</h2>
          <p>Try another filter to see the shared movement record.</p>
        </div>
      )}
      <WorkerToolDetailSheet toolUnitId={selectedToolId} onClose={() => setSelectedToolId(null)} />
    </div>
  );
}
