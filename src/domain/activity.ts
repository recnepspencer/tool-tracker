import type { CustodyEvidence } from './evidence';

export const ACTIVITY_KINDS = ['custody', 'request', 'flag', 'admin'] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const ACTIVITY_SCOPES = ['worker', 'warehouse', 'damage', 'admin'] as const;
export type ActivityScope = (typeof ACTIVITY_SCOPES)[number];

export interface AuditEvent {
  id: string;
  actorId: string;
  action: string;
  toolUnitId?: string;
  kind: ActivityKind;
  scope: ActivityScope;
  participantIds: string[];
  warehouseId?: string;
  occurredAt: string;
  evidence?: CustodyEvidence;
}

export const ACTIVITY_TIME_ZONE = 'America/Denver';

const CANONICAL_INSTANT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/;

export const parseCanonicalInstant = (value: string): number | null => {
  const match = CANONICAL_INSTANT_PATTERN.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fractionText, zone] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const fraction = Number((fractionText ?? '').padEnd(3, '0') || '0');
  const offsetMatch = zone === 'Z' ? null : /([+-])(\d{2}):(\d{2})/.exec(zone);
  const offsetMinutes = offsetMatch
    ? (offsetMatch[1] === '+' ? 1 : -1) * (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3]))
    : 0;
  if (offsetMinutes > 23 * 60 + 59 || offsetMinutes < -(23 * 60 + 59)) return null;
  const epoch = Date.parse(value);
  if (Number.isNaN(epoch)) return null;
  const local = new Date(epoch + offsetMinutes * 60_000);
  if (
    local.getUTCFullYear() !== year ||
    local.getUTCMonth() + 1 !== month ||
    local.getUTCDate() !== day ||
    local.getUTCHours() !== hour ||
    local.getUTCMinutes() !== minute ||
    local.getUTCSeconds() !== second ||
    local.getUTCMilliseconds() !== fraction
  ) {
    return null;
  }
  return epoch;
};

export const compareActivityTimestamps = (left: string, right: string): number => {
  const leftEpoch = parseCanonicalInstant(left);
  const rightEpoch = parseCanonicalInstant(right);
  if (leftEpoch !== null && rightEpoch !== null) return rightEpoch - leftEpoch;
  if (leftEpoch !== null) return -1;
  if (rightEpoch !== null) return 1;
  return 0;
};

export const formatActivityTimestamp = (value: string): string => {
  const parsed = parseCanonicalInstant(value);
  if (parsed === null) throw new Error('Invalid activity timestamp: ' + value);
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: ACTIVITY_TIME_ZONE,
  }).format(parsed);
};
