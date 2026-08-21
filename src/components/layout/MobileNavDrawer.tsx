import { useRef } from 'react';
import type { Role } from '../../domain/auth';
import { useModalFocusTrap } from '../ui/use-modal-focus-trap';
import { NavItems } from './NavItems';

export function MobileNavDrawer({ role, open, onClose }: { role: Role; open: boolean; onClose(): void }) {
  const drawerRef = useRef<HTMLElement>(null);
  useModalFocusTrap(open, onClose, drawerRef);

  if (!open) return null;
  return (
    <div
      className="mobile-nav-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside
        ref={drawerRef}
        className="mobile-nav-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={role + ' mobile navigation'}
      >
        <div className="mobile-nav-header">
          <span className="eyebrow">{role === 'worker' ? 'Field view' : 'Control room'}</span>
          <button type="button" className="icon-button" aria-label="Close navigation" onClick={onClose}>
            ×
          </button>
        </div>
        <nav>
          <NavItems role={role} onNavigate={onClose} />
        </nav>
      </aside>
    </div>
  );
}
