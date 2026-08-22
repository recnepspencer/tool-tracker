import { SurfaceCard } from '../../components/ui/SurfaceCard';
import type { AuditEventView } from '../../domain/read-models/activity';

export function AuditLog({ events }: { events: AuditEventView[] }) {
  const groups = groupEvents(events);
  return (
    <SurfaceCard className="audit-card">
      {events.length ? (
        <div className="audit-list">
          {groups.map((group) => (
            <section className="audit-group" key={group.label}>
              <div className="audit-group__heading">
                <h2>{group.label}</h2>
                <span>{group.events.length}</span>
              </div>
              <div className="audit-group__rows">
                {group.events.map((event) => (
                  <article className="audit-row" key={event.id}>
                    <time className="audit-row__time" dateTime={event.timestamp}>
                      {formatAuditTime(event.timestamp)}
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
                    </div>
                    <span className="audit-row__tool">
                      {event.toolName ?? 'Workspace'}
                      {event.toolUnitId ? ` · ${event.toolUnitId}` : ''}
                    </span>
                    <span className="admin-meta-kind">{event.kind}</span>
                  </article>
                ))}
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

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toLocaleUpperCase();

const formatAuditTime = (timestamp: string) =>
  new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(timestamp));

function groupEvents(events: AuditEventView[]) {
  const groups = new Map<string, AuditEventView[]>();
  events.forEach((event) => {
    const label = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).format(
      new Date(event.timestamp),
    );
    groups.set(label, [...(groups.get(label) ?? []), event]);
  });
  return [...groups.entries()].map(([label, groupedEvents]) => ({ label, events: groupedEvents }));
}
