import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cx } from '../../lib/cx';
import { useModalFocusTrap } from './use-modal-focus-trap';
import './OverlayDialog.css';

export function OverlayDialog({
  label,
  onClose,
  children,
  backdropClassName,
  panelClassName,
  showCloseButton = false,
  closeLabel = 'Close dialog',
}: {
  label: string;
  onClose(): void;
  children: ReactNode;
  backdropClassName?: string;
  panelClassName?: string;
  showCloseButton?: boolean;
  closeLabel?: string;
}) {
  const panelRef = useRef<HTMLElement>(null);
  useModalFocusTrap(true, onClose, panelRef);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  useLayoutEffect(() => {
    if (panelRef.current) panelRef.current.scrollTop = 0;
    const scrollRegion = panelRef.current?.querySelector<HTMLElement>('[data-overlay-scroll]');
    if (scrollRegion) scrollRegion.scrollTop = 0;
  }, [label]);
  return (
    <div
      className={cx('overlay-backdrop', backdropClassName)}
      role="presentation"
      onPointerDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={panelRef}
        className={cx('overlay-panel', panelClassName)}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {showCloseButton ? (
          <button type="button" className="overlay-close" aria-label={closeLabel} onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        ) : null}
        {children}
      </section>
    </div>
  );
}
