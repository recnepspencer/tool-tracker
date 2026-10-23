import type { ActivityView } from '../../domain/read-models/activity';

export function CustodyTimeline({ events }: { events: ActivityView[] }) {
  return (
    <section className="detail-timeline" aria-labelledby="timeline-heading">
      <div className="detail-section-heading">
        <span className="eyebrow">Custody record</span>
        <h3 id="timeline-heading">Timeline</h3>
      </div>
      {events.length ? (
        <ol>
          {events.map((event) => (
            <li key={event.id}>
              <span className={`activity-dot activity-dot--${event.kind}`} />
              <div>
                <strong>{event.action}</strong>
                <span>
                  {event.actor} · {event.time}
                </span>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="detail-empty">No movement events have been recorded for this unit yet.</p>
      )}
    </section>
  );
}
