import { Wrench } from 'lucide-react';
import { activityTag, groupByDay } from './activity-presentation';
import type { ActivityFilter, ActivityRow } from './activity-state';
import { formatDate, formatTime } from './format';
import { cx } from './kit';

const filters: Array<{ value: ActivityFilter; label: string }> = [
  { value: 'all', label: 'All activity' },
  { value: 'mine', label: 'Mine' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'damage', label: 'Damage & loss' },
];

/** Demo `ActivityFilters`: exclusive worker activity chips. */
export function ActivityFilters({
  value,
  onChange,
}: {
  value: ActivityFilter | null;
  onChange(value: ActivityFilter): void;
}) {
  return (
    <div className="activity-filters" aria-label="Activity filters">
      {filters.map((filter) => (
        <button
          type="button"
          key={filter.value}
          className={value === filter.value ? 'activity-filter--active' : ''}
          aria-pressed={value === filter.value}
          onClick={() => onChange(filter.value)}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

/** Demo worker day groups of `ActivityFeed` cards. */
export function ActivityGroups({ rows, onSelect }: { rows: ActivityRow[]; onSelect(row: ActivityRow): void }) {
  const groups = groupByDay(
    rows.map((row) => ({ ...row, occurred_at: row.occurredAt })),
    formatDate,
  );
  return (
    <div className="activity-groups">
      {groups.map((group) => (
        <section className="activity-group" key={group.label}>
          <div className="worker-activity-day">{group.label}</div>
          <ActivityFeed events={group.items} onSelect={onSelect} />
        </section>
      ))}
    </div>
  );
}

function ActivityFeed({ events, onSelect }: { events: ActivityRow[]; onSelect(row: ActivityRow): void }) {
  return (
    <div className="activity-feed">
      {events.map((event) => {
        const toolName = event.toolName ?? event.unit;
        const context = [toolName, event.warehouseName].filter(Boolean).join(' · ');
        const content = (
          <>
            <span className={cx('worker-activity-photo', !event.imageSrc && 'tool-photo--empty')}>
              {event.imageSrc ? (
                <img src={event.imageSrc} sizes="46px" alt="" loading="lazy" decoding="async" />
              ) : (
                <Wrench aria-hidden="true" />
              )}
            </span>
            <span className="worker-activity-copy">
              <strong>
                {event.actor} · {event.action}
              </strong>
              {context && <span className="worker-activity-context">{context}</span>}
              <span className="worker-activity-tags">
                <span className={`worker-activity-tag worker-activity-tag--${event.kind}`}>
                  {activityTag[event.kind]}
                </span>
                <time dateTime={event.occurredAt}>{formatTime(event.occurredAt)}</time>
              </span>
            </span>
            <span className={`activity-dot activity-dot--${event.kind}`} />
          </>
        );
        return event.route ? (
          <button
            type="button"
            className="worker-activity-row worker-activity-card"
            key={event.id}
            onClick={() => onSelect(event)}
            aria-label={`Open ${toolName ?? 'tool'} details`}
          >
            {content}
          </button>
        ) : (
          <div className="worker-activity-row worker-activity-card" key={event.id}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
