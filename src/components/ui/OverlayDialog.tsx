import { useEffect, useRef, type ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { useModalFocusTrap } from './use-modal-focus-trap';
import './OverlayDialog.css';

export function OverlayDialog({
  label,
  onClose,
  children,
  backdropClassName,
  panelClassName,
}: {
  label: string;
  onClose(): void;
  children: ReactNode;
  backdropClassName?: string;
  panelClassName?: string;
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
        {children}
      </section>
    </div>
  );
}
