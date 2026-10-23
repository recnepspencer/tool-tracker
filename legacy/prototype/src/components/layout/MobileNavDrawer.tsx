import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { Role } from '../../domain/auth';
import type { AuthSession } from '../../domain/auth';
import { useModalFocusTrap } from '../ui/use-modal-focus-trap';
import { NavItems } from './NavItems';
import { ThemeToggle } from './ThemeToggle';
import './WorkerRoleShell.css';

export function MobileNavDrawer({
  role,
  session,
  open,
  theme,
  onToggleTheme,
  onClose,
  onOpenAccount,
}: {
  role: Role;
  session: AuthSession;
  open: boolean;
  theme: 'dark' | 'light';
  onToggleTheme(): void;
  onClose(): void;
  onOpenAccount(): void;
}) {
  const drawerRef = useRef<HTMLElement>(null);
  useModalFocusTrap(open, onClose, drawerRef);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="worker-navigation-layer" role="presentation">
      <button type="button" className="worker-scrim" aria-label="Close navigation backdrop" onClick={onClose} />
      <aside
        ref={drawerRef}
        className="worker-navigation-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`${role === 'admin' ? 'Admin' : 'Worker'} navigation`}
      >
        <div className="worker-drawer-header">
          <button type="button" className="worker-close-button" aria-label="Close navigation" onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          className="worker-drawer-profile"
          aria-label={`Open account for ${session.name}`}
          onClick={onOpenAccount}
        >
          <span className="worker-avatar">{initials(session.name)}</span>
          <div>
            <strong>{session.name}</strong>
            <span>{session.title}</span>
          </div>
        </button>
        <nav className="worker-drawer-nav" aria-label={`${role === 'admin' ? 'Admin' : 'Worker'} navigation links`}>
          <NavItems role={role} onNavigate={onClose} variant="drawer" />
        </nav>
        <div className="worker-drawer-theme">
          <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} />
        </div>
      </aside>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
