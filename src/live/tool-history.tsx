import { useId } from 'react';
import { formatStamp } from './format';
import { Button, ErrorState, LoadingState, ToolPhoto } from './kit';
import { photoSrc } from './tool-status';
import { incidentLabels, timelineEntries } from './tool-detail-timeline';
import type { ToolDetailState } from './tools-state';
import './experience/tool-detail-live.css';

/** Evidence photos as the demo's small matted thumbnails, each opening the full photo. */
export function EvidenceThumbnails({ companyId, ids, label }: { companyId: string; ids: string[]; label: string }) {
  if (!ids.length) return null;
  return (
    <div className="tool-detail-evidence">
      {ids.map((id, index) => (
        <a key={id} href={photoSrc(companyId, id, 'original') ?? undefined} target="_blank" rel="noreferrer">
          <ToolPhoto src={photoSrc(companyId, id)} alt={`${label} photo ${index + 1}`} size="small" />
        </a>
      ))}
    </div>
  );
}

/** The demo's CustodyTimeline, fed by custody, service, lifecycle and incident records. */
export function CustodyTimeline({ state }: { state: ToolDetailState }) {
  const { c, history, service, lifecycle, incidents, retryHistory } = state;
  const headingId = useId();
  const loading = history.isPending || service.isPending || lifecycle.isPending || incidents.isPending;
  const failed = history.error || service.error || lifecycle.error || incidents.error;
  if (loading) return <LoadingState label="Loading custody history…" />;
  if (failed) return <ErrorState message="Custody history could not be loaded." onRetry={retryHistory} />;
  const events = timelineEntries({
    custody: history.data ?? [],
    service: service.data ?? [],
    lifecycle: lifecycle.data ?? [],
    incidents: incidents.data ?? [],
  });
  return (
    <section className="detail-timeline" aria-labelledby={headingId}>
      <div className="detail-section-heading">
        <h3 id={headingId}>Timeline</h3>
      </div>
      {events.length ? (
        <ol>
          {events.map((event) => (
            <li key={event.id}>
              <span className={`activity-dot activity-dot--${event.kind}`} />
              <div>
                <strong>{event.action}</strong>
                {event.note && <p className="tool-detail-note">{event.note}</p>}
                <EvidenceThumbnails companyId={c.company_id} ids={event.photos} label={event.action} />
                <span>{event.meta}</span>
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

/** Open damage and loss reports as a second timeline section, with "Mark found" for managers. */
export function ToolReports({
  state,
  manages,
  onMarkFound,
}: {
  state: ToolDetailState;
  manages: boolean;
  onMarkFound(incidentId: string): void;
}) {
  const { c, incidents } = state;
  const headingId = useId();
  const open = incidents.data?.filter((incident) => !incident.resolved_at) ?? [];
  if (!open.length) return null;
  return (
    <section className="detail-timeline tool-detail-reports" aria-labelledby={headingId}>
      <div className="detail-section-heading">
        <h3 id={headingId}>Open reports</h3>
      </div>
      <ol>
        {open.map((incident) => (
          <li key={incident.id} aria-label={incidentLabels[incident.kind]}>
            <span className="activity-dot activity-dot--flag" />
            <div>
              <strong>{incidentLabels[incident.kind]}</strong>
              <p className="tool-detail-note">{incident.description}</p>
              <EvidenceThumbnails companyId={c.company_id} ids={incident.photo_ids} label="Report" />
              <span>
                {incident.reported_by_name} · {formatStamp(incident.reported_at)}
              </span>
            </div>
            {manages && incident.kind === 'missing' && (
              <Button
                variant="secondary"
                className="tool-detail-report-action"
                onClick={() => onMarkFound(incident.id)}
              >
                Mark found
              </Button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
