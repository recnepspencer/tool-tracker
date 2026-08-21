import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { useModalFocusTrap } from '../ui/use-modal-focus-trap';
import type { AuthSession } from '../../domain/auth';
import { ThemeToggle } from './ThemeToggle';

interface WorkerNavigationDrawerProps {
  open: boolean;
  session: AuthSession;
  theme: 'dark' | 'light';
  onToggleTheme(): void;
  onClose(): void;
  onOpenAddTool(): void;
  onOpenAccount(): void;
}

export function WorkerNavigationDrawer({
  open,
  session,
  theme,
  onToggleTheme,
  onClose,
  onOpenAddTool,
  onOpenAccount,
}: WorkerNavigationDrawerProps) {
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
        aria-label="Worker navigation"
      >
        <div className="worker-drawer-profile">
          <span className="worker-avatar">{initials(session.name)}</span>
          <div>
            <strong>{session.name}</strong>
            <span>{session.title}</span>
          </div>
          <button type="button" className="worker-close-button" aria-label="Close navigation" onClick={onClose}>
            ×
          </button>
        </div>

        <nav className="worker-drawer-nav" aria-label="Worker navigation">
          <WorkerNavLink to="/worker/tools" label="My tools" onClick={onClose} />
          <WorkerNavLink to="/worker/checkout" label="Checkout" onClick={onClose} />
          <WorkerNavLink to="/worker/activity" label="Activity" onClick={onClose} />
        </nav>

        <div className="worker-drawer-divider" />

        <div className="worker-drawer-theme">
          <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} />
        </div>

        <div className="worker-drawer-actions">
          <button type="button" className="worker-drawer-action worker-drawer-action--accent" onClick={onOpenAddTool}>
            <span className="worker-drawer-action-icon">+</span>
            <span>Add a tool</span>
            <span className="worker-drawer-badge">Setup</span>
          </button>
          <button type="button" className="worker-drawer-action" disabled>
            <span className="worker-drawer-action-icon">⌁</span>
            <span>Warehouses</span>
            <span className="worker-drawer-badge">Later</span>
          </button>
          <button type="button" className="worker-drawer-action" aria-label="Account" onClick={onOpenAccount}>
            <span className="worker-drawer-action-icon">◎</span>
            <span>Account</span>
          </button>
        </div>
      </aside>
    </div>
  );
}

function WorkerNavLink({ to, label, onClick }: { to: string; label: string; onClick(): void }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) => `worker-drawer-link${isActive ? ' worker-drawer-link--active' : ''}`}
    >
      <span className="worker-drawer-link-dot" />
      <span>{label}</span>
    </NavLink>
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
