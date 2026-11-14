import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { cx } from './cx';
import { useModalFocusTrap } from '../experience/use-modal-focus-trap';
import './OverlayDialog.css';

export function OverlayDialog({
  label,
  onClose,
  children,
  backdropClassName,
  panelClassName,
  showCloseButton = false,
  closeLabel = 'Close dialog',
  page = false,
}: {
  label: string;
  onClose(): void;
  children: ReactNode;
  backdropClassName?: string;
  panelClassName?: string;
  showCloseButton?: boolean;
  closeLabel?: string;
  /** A record big enough to be a page: full screen on phones, with a back arrow instead of a close button. */
  page?: boolean;
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
        className={cx('overlay-panel', page && 'overlay-panel--page', panelClassName)}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {showCloseButton ? (
          <button type="button" className="overlay-close" aria-label={closeLabel} onClick={onClose}>
            <X className="overlay-close__x" aria-hidden="true" />
            {page ? <ChevronLeft className="overlay-close__back" aria-hidden="true" /> : null}
          </button>
        ) : null}
        {children}
      </section>
    </div>
  );
}
