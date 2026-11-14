import { useId, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { formatStamp } from './format';
import { Button, ToolPhoto, cx } from './kit';
import type { HistoryEntry, QueueAction, QueueEntry, QueueKind } from './queue-groups';

export const actionLabels: Record<QueueAction, string> = {
  approve: 'Release',
  reject: 'Decline',
  accept: 'Accept',
  decline: 'Decline',
  withdraw: 'Withdraw',
  cancel: 'Cancel',
};

export const kindNouns: Record<QueueKind, string> = {
  request: 'request',
  pickup: 'pickup',
  return: 'return',
  transfer: 'transfer',
};

/** One headed, counted group of rows. The count sits outside the heading so the region keeps a plain name. */
export function QueueSection({
  title,
  count,
  quiet = false,
  children,
}: {
  title: string;
  count?: number;
  quiet?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className={cx('queue-section', quiet && 'queue-section--quiet')} aria-labelledby={id}>
      <header className="queue-section__head">
        <h2 id={id}>{title}</h2>
        {count !== undefined && (
          <span className="queue-section__count" aria-label={`${count} ${count === 1 ? 'item' : 'items'}`}>
            {count}
          </span>
        )}
      </header>
      <ul className="queue-rows">{children}</ul>
    </section>
  );
}

function RowText({ title, note, meta }: { title: string; note: string; meta: ReactNode }) {
  return (
    <span className="queue-row__text">
      <strong className="queue-row__title">{title}</strong>
      {note && <span className="queue-row__note">“{note}”</span>}
      <span className="queue-row__meta">{meta}</span>
    </span>
  );
}

/** A request, return, pickup or transfer: tap for the note and every option, or decide on the row. */
export function AskRow({
  entry,
  photo,
  busy,
  onReview,
  onAction,
}: {
  entry: QueueEntry;
  photo: string | null;
  busy: boolean;
  onReview(entry: QueueEntry): void;
  onAction(entry: QueueEntry, action: QueueAction): void;
}) {
  const noun = kindNouns[entry.kind];
  return (
    <li className="queue-row">
      <button
        type="button"
        className="queue-row__open"
        disabled={busy}
        onClick={() => onReview(entry)}
        aria-label={`Review ${noun} for ${entry.toolName}`}
      >
        <ToolPhoto src={photo} alt="" size="small" />
        <RowText
          title={entry.title}
          note={entry.note}
          meta={
            <>
              {entry.status && <span className="queue-row__status">{entry.status}</span>}
              <time dateTime={entry.at}>{formatStamp(entry.at)}</time>
            </>
          }
        />
        <ChevronRight className="queue-row__chevron" aria-hidden="true" />
      </button>
      {entry.actions.length > 0 && (
        <div className="queue-row__actions">
          {entry.actions.map((action, index) => (
            <Button
              key={action}
              variant={index === entry.actions.length - 1 && entry.actions.length > 1 ? 'primary' : 'secondary'}
              disabled={busy}
              aria-label={`${actionLabels[action]} ${noun} for ${entry.toolName}`}
              onClick={() => onAction(entry, action)}
            >
              {actionLabels[action]}
            </Button>
          ))}
        </div>
      )}
    </li>
  );
}

/** A row that opens another page: a damaged or lost tool, or a record to fix. */
export function LinkRow({
  to,
  state,
  label,
  title,
  note,
  at,
  photo,
}: {
  to: string;
  state?: unknown;
  label: string;
  title: string;
  note: string;
  at: string | null;
  photo: string | null;
}) {
  return (
    <li className="queue-row">
      <Link className="queue-row__open" to={to} state={state} aria-label={label}>
        <ToolPhoto src={photo} alt="" size="small" />
        <RowText title={title} note={note} meta={at ? <time dateTime={at}>{formatStamp(at)}</time> : null} />
        <ChevronRight className="queue-row__chevron" aria-hidden="true" />
      </Link>
    </li>
  );
}

/** A past decision: what was asked, how it ended, and the note left with it. */
export function HistoryRow({ entry, photo }: { entry: HistoryEntry; photo: string | null }) {
  return (
    <li className="queue-row">
      <div className="queue-row__open queue-row__open--static">
        <ToolPhoto src={photo} alt="" size="small" />
        <RowText
          title={entry.title}
          note={entry.note}
          meta={
            <>
              <span className="queue-row__status">{entry.outcome}</span>
              <time dateTime={entry.at}>{formatStamp(entry.at)}</time>
            </>
          }
        />
      </div>
    </li>
  );
}
