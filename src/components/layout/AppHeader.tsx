import { Menu } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { AccountMenu } from './AccountMenu';
import { BrandMark } from './BrandMark';
import type { AuthSession, Role } from '../../domain/auth';

export interface AppHeaderProps {
  role: Role;
  session: AuthSession;
  onSignOut(): void;
  onOpenNavigation(): void;
}

export function AppHeader({ role, session, onSignOut, onOpenNavigation }: AppHeaderProps) {
  const isWorker = role === 'worker';

  return (
    <header className="app-header">
      <div className="header-leading">
        <button
          type="button"
          className="mobile-nav-trigger worker-menu-button"
          onClick={onOpenNavigation}
          aria-label="Open navigation"
        >
          <Menu aria-hidden="true" />
        </button>
        <NavLink className="wordmark" to={isWorker ? '/worker/tools' : '/admin/dashboard'}>
          <span className="desktop-wordmark-mark">
            <BrandMark />
          </span>
          <span className="desktop-wordmark-copy">
            Nelson <em>Electric</em>
          </span>
          <span className="mobile-wordmark-copy">NELSON ELECTRIC</span>
        </NavLink>
      </div>
      <div className="desktop-header-account">
        <AccountMenu role={role} session={session} onSignOut={onSignOut} />
      </div>
    </header>
  );
}
