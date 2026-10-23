import type { ActivityView } from '../../domain/read-models/activity';
import { ACTIVITY_TIME_ZONE, compareActivityTimestamps, parseCanonicalInstant } from '../../domain/activity';

export type ActivityFilter = 'all' | 'mine' | 'warehouse' | 'damage';

export function filterActivity(events: ActivityView[], filter: ActivityFilter, profileId: string) {
  return events.filter((event) => {
    if (filter === 'mine') return event.participantIds.includes(profileId);
    if (filter === 'warehouse') return event.scope === 'warehouse';
    if (filter === 'damage') return event.scope === 'damage' || event.kind === 'flag';
    return true;
  });
}

export function groupActivity(events: ActivityView[]) {
  const groups = new Map<string, ActivityView[]>();
  [...events]
    .sort((a, b) => compareActivityTimestamps(a.timestamp, b.timestamp))
    .forEach((event) => {
      const parsed = parseCanonicalInstant(event.timestamp);
      const day =
        parsed === null
          ? (event.time.split(' · ')[0] ?? 'Earlier')
          : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: ACTIVITY_TIME_ZONE }).format(parsed);
      const group = groups.get(day) ?? [];
      group.push(event);
      groups.set(day, group);
    });
  return [...groups.entries()].map(([label, items]) => ({ label, items }));
}
