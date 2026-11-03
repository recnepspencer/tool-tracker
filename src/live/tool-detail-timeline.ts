import type { Model } from './client';
import { formatStamp } from './format';

/** One row of the demo's CustodyTimeline: `{action, actor, time, kind}` plus live evidence. */
export type TimelineEntry = {
  id: string;
  kind: 'custody' | 'request' | 'flag' | 'admin';
  action: string;
  meta: string;
  note?: string;
  photos: string[];
  at: string;
};

const serviceActions: Record<Model<'ServiceView'>['resulting_serviceability'], string> = {
  serviceable: 'Restored to service',
  damaged: 'Service recorded · still damaged',
  out_of_service: 'Taken out of service',
};

const lifecycleActions: Record<Model<'LifecycleView'>['to_lifecycle'], string> = {
  active: 'Returned to active inventory',
  retired: 'Retired',
  disposed: 'Disposed',
};

export const incidentLabels: Record<Model<'IncidentView'>['kind'], string> = {
  damage: 'Reported damaged',
  missing: 'Reported lost',
};

const resolvedLabels: Record<Model<'IncidentView'>['kind'], string> = {
  damage: 'Damage report closed',
  missing: 'Marked found',
};

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' · ');

function custodyEntries(periods: Model<'CustodyView'>[]): TimelineEntry[] {
  const ordered = [...periods].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return ordered.map((period, index) => {
    const previous = ordered[index - 1];
    const toPerson = !!period.holder_membership_id;
    const action = toPerson
      ? previous?.holder_membership_id
        ? `Handed to ${period.holder_name}`
        : `Checked out to ${period.holder_name}`
      : !previous
        ? `Registered at ${period.holder_name}`
        : previous.holder_membership_id
          ? `Returned to ${period.holder_name}`
          : `Moved to ${period.holder_name}`;
    return {
      id: `custody:${period.id}`,
      kind: 'custody',
      action,
      meta: join(period.ends_at ? null : 'Current holder', formatStamp(period.starts_at)),
      photos: [],
      at: period.starts_at,
    };
  });
}

/** Custody periods, service, lifecycle and incidents merged newest first. */
export function timelineEntries({
  custody,
  service,
  lifecycle,
  incidents,
}: {
  custody: Model<'CustodyView'>[];
  service: Model<'ServiceView'>[];
  lifecycle: Model<'LifecycleView'>[];
  incidents: Model<'IncidentView'>[];
}): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...custodyEntries(custody),
    ...service.map((event): TimelineEntry => ({
      id: `service:${event.id}`,
      kind: event.resulting_serviceability === 'serviceable' ? 'admin' : 'flag',
      action: serviceActions[event.resulting_serviceability],
      meta: join(event.performed_by_name, formatStamp(event.occurred_at)),
      note: event.note,
      photos: event.photo_ids,
      at: event.occurred_at,
    })),
    ...lifecycle.map((event): TimelineEntry => ({
      id: `lifecycle:${event.id}`,
      kind: 'admin',
      action: lifecycleActions[event.to_lifecycle],
      meta: join(event.actor_name, formatStamp(event.occurred_at)),
      note: event.reason,
      photos: [],
      at: event.occurred_at,
    })),
    ...incidents.flatMap((incident): TimelineEntry[] => [
      {
        id: `incident:${incident.id}`,
        kind: 'flag',
        action: incidentLabels[incident.kind],
        meta: join(incident.reported_by_name, formatStamp(incident.reported_at)),
        note: incident.description,
        photos: incident.photo_ids,
        at: incident.reported_at,
      },
      ...(incident.resolved_at
        ? [
            {
              id: `resolved:${incident.id}`,
              kind: incident.kind === 'missing' ? ('custody' as const) : ('admin' as const),
              action: resolvedLabels[incident.kind],
              meta: join(incident.resolved_by_name, formatStamp(incident.resolved_at)),
              note: incident.resolution_note,
              photos: [],
              at: incident.resolved_at,
            },
          ]
        : []),
    ]),
  ];
  return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
