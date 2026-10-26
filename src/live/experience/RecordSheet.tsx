import { useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useModalFocusTrap } from './use-modal-focus-trap';

export function RecordSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useModalFocusTrap(true, onClose, ref);
  return (
    <div
      className="record-sheet-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section ref={ref} className="record-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <button
          type="button"
          className="record-sheet-close"
          onClick={onClose}
          aria-label={`Close ${title.toLowerCase()}`}
        >
          <X size={18} />
        </button>
        {children}
      </section>
    </div>
  );
}
