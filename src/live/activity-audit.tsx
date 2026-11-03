import { Link, useLocation } from 'react-router-dom';
import { groupByDay } from './activity-presentation';
import type { ActivityRow, AuditKindFilter } from './activity-state';
import { initials } from './format';
import { SurfaceCard } from './kit';

const groupFormat = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

const kindChips: ReadonlyArray<readonly [AuditKindFilter, string]> = [
  ['all', 'Everything'],
  ['custody', 'Custody'],
  ['request', 'Requests'],
  ['flag', 'Flags'],
  ['admin', 'Admin'],
];

/** Demo `AuditLogFilters` kind chips, plus the live "only my activity" scope as a toggle chip. */
export function AuditKindChips({
  kind,
  onKindChange,
  mine,
  onMineChange,
}: {
  kind: AuditKindFilter;
  onKindChange(value: AuditKindFilter): void;
  mine?: boolean;
  onMineChange?(value: boolean): void;
}) {
  return (
    <div className="activity-kind-chips" aria-label="Audit event type">
      {kindChips.map(([value, label]) => (
        <button
          type="button"
          key={value}
          className={kind === value ? 'activity-kind-chip activity-kind-chip--active' : 'activity-kind-chip'}
          aria-pressed={kind === value}
          onClick={() => onKindChange(value)}
        >
          {label}
        </button>
      ))}
      {onMineChange && (
        <button
          type="button"
          className={mine ? 'activity-kind-chip activity-kind-chip--active' : 'activity-kind-chip'}
          aria-pressed={!!mine}
          onClick={() => onMineChange(!mine)}
        >
          Only my activity
        </button>
      )}
    </div>
  );
}

/** Demo `AuditLog`: day groups of audit rows. */
export function AuditLog({ rows }: { rows: ActivityRow[] }) {
  const location = useLocation();
  const groups = groupByDay(
    rows.map((row) => ({ ...row, occurred_at: row.occurredAt })),
    (value) => groupFormat.format(new Date(value)),
  );
  return (
    <SurfaceCard className="audit-card">
      {rows.length ? (
        <div className="audit-list">
          {groups.map((group) => (
            <section className="audit-group" key={group.label}>
              <div className="audit-group__heading">
                <h2>{group.label}</h2>
                <span>{group.items.length}</span>
              </div>
              <div className="audit-group__rows">
                {group.items.map((event) => {
                  const tool = event.toolName
                    ? `${event.toolName}${event.unit ? ` · ${event.unit}` : ''}`
                    : (event.unit ?? 'Workspace');
                  return (
                    <article className="audit-row" key={event.id}>
                      <time className="audit-row__time" dateTime={event.occurredAt}>
                        {timeFormat.format(new Date(event.occurredAt))}
                      </time>
                      <span className="audit-row__avatar" aria-hidden="true">
                        {initials(event.actor)}
                      </span>
                      <div className="audit-row__body">
                        <strong>{event.action}</strong>
                        <p>
                          {event.actor}
                          {event.warehouseName ? ` · ${event.warehouseName}` : ''}
                        </p>
                        {event.note && <p>“{event.note}”</p>}
                      </div>
                      <span className="audit-row__tool">
                        {event.route ? (
                          <Link to={event.route} state={{ returnTo: location.pathname + location.search }}>
                            {tool}
                          </Link>
                        ) : (
                          tool
                        )}
                      </span>
                      <span className="admin-meta-kind">{event.kind}</span>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p className="admin-empty">No audit events match these filters.</p>
      )}
    </SurfaceCard>
  );
}
