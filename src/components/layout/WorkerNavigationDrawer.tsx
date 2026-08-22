import { useEffect, useRef } from 'react';
import { Activity, PackageCheck, Plus, Wrench, X, type LucideIcon } from 'lucide-react';
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

        <nav className="worker-drawer-nav" aria-label="Worker navigation">
          <WorkerNavLink to="/worker/tools" label="My tools" icon={Wrench} onClick={onClose} />
          <WorkerNavLink to="/worker/checkout" label="Checkout" icon={PackageCheck} onClick={onClose} />
          <WorkerNavLink to="/worker/activity" label="Activity" icon={Activity} onClick={onClose} />
          <WorkerNavAction label="Add a tool" icon={Plus} onClick={onOpenAddTool} />
        </nav>

        <div className="worker-drawer-theme">
          <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} />
        </div>
      </aside>
    </div>
  );
}

function WorkerNavLink({
  to,
  label,
  icon: Icon,
  onClick,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  onClick(): void;
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) => `worker-drawer-link${isActive ? ' worker-drawer-link--active' : ''}`}
    >
      <Icon className="worker-drawer-link-icon" aria-hidden="true" />
      <span>{label}</span>
    </NavLink>
  );
}

function WorkerNavAction({ label, icon: Icon, onClick }: { label: string; icon: LucideIcon; onClick(): void }) {
  return (
    <button type="button" className="worker-drawer-link worker-drawer-link--accent" onClick={onClick}>
      <Icon className="worker-drawer-link-icon" aria-hidden="true" />
      <span>{label}</span>
    </button>
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
