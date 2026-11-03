// Shared display formatting. Enum labels belong beside the screens that show them.

const dayFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const shortDayFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

const parse = (value: string | Date) => (value instanceof Date ? value : new Date(value));

/** "Oct 22, 2026" */
export const formatDate = (value: string | Date) => dayFormat.format(parse(value));

/** "Oct 22, 2026 · 5:20 PM" */
export const formatDateTime = (value: string | Date) => `${formatDate(value)} · ${timeFormat.format(parse(value))}`;

/** "5:20 PM" */
export const formatTime = (value: string | Date) => timeFormat.format(parse(value));

/** "Today", "Yesterday", or "Oct 22" — for day group headings and compact rows. */
export function formatDay(value: string | Date, now = new Date()) {
  const date = parse(value);
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((start(now) - start(date)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return date.getFullYear() === now.getFullYear() ? shortDayFormat.format(date) : dayFormat.format(date);
}

/** "Today · 5:20 PM", "Oct 22 · 5:20 PM" — the demo's compact event stamp. */
export const formatStamp = (value: string | Date) => `${formatDay(value)} · ${formatTime(value)}`;

/** A date range where an open end reads as ongoing. */
export const formatRange = (start: string, end: string | null) =>
  end ? `${formatDate(start)} – ${formatDate(end)}` : `Since ${formatDate(start)}`;

/** Sentence-case fallback for an enum value that has no explicit label. */
export const sentence = (value: string) => {
  const words = value.replaceAll(/[._-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** Two-letter initials for avatars. */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('') || '?';
