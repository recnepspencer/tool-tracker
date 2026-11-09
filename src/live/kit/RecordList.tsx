import { useEffect, useRef, type PropsWithChildren, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { SurfaceCard } from './SurfaceCard';
import './RecordList.css';

export interface RecordListItem {
  id: string;
  title: string;
  detail?: ReactNode;
  /** A right-hand column on wide screens, a third line on phones. */
  meta?: ReactNode;
  /** The row's accessible name, such as "Open Riverside lighting". */
  label: string;
}

/** A list where the whole row opens the record, the phone-first replacement for a directory table. */
export function RecordList({
  label,
  items,
  empty,
  onSelect,
}: {
  label: string;
  items: RecordListItem[];
  empty: string;
  onSelect(id: string): void;
}) {
  if (!items.length) return <p className="admin-empty">{empty}</p>;
  return (
    <ul className="record-list" aria-label={label}>
      {items.map((item) => (
        <li key={item.id}>
          <button type="button" className="record-row" aria-label={item.label} onClick={() => onSelect(item.id)}>
            <span className="record-row__main">
              <strong>{item.title}</strong>
              {item.detail ? <span>{item.detail}</span> : null}
            </span>
            {item.meta ? <span className="record-row__meta">{item.meta}</span> : null}
            <ChevronRight className="record-row__chevron" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Archived records sit behind one control instead of a second row of tabs:
 * "Show archived" ends the active list, and the archived list starts with the way back.
 */
export function ArchivableList({
  archived,
  noun,
  onArchivedChange,
  children,
}: PropsWithChildren<{ archived: boolean; noun: string; onArchivedChange(archived: boolean): void }>) {
  return (
    <>
      {archived && (
        <div className="archived-notice">
          <strong>Archived {noun}</strong>
          <button type="button" className="archived-toggle" onClick={() => onArchivedChange(false)}>
            Show active {noun}
          </button>
        </div>
      )}
      <SurfaceCard className="admin-table-card">{children}</SurfaceCard>
      {!archived && (
        <button type="button" className="archived-toggle archived-toggle--end" onClick={() => onArchivedChange(true)}>
          Show archived {noun}
        </button>
      )}
    </>
  );
}

const UNDO_MS = 8000;

/** Confirms a reversible change and offers to take it back for a few seconds. */
export function UndoToast({ message, onUndo, onDismiss }: { message: string; onUndo(): void; onDismiss(): void }) {
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useEffect(() => {
    const timer = window.setTimeout(() => dismiss.current(), UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [message]);
  return (
    <div className="undo-toast" role="status">
      <span>{message}</span>
      <button type="button" onClick={onUndo}>
        Undo
      </button>
    </div>
  );
}
