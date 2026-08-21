import { NavLink } from 'react-router-dom';
import { AccountMenu } from './AccountMenu';
import { BrandMark } from './BrandMark';
import type { AuthSession, Role } from '../../domain/auth';
import { Button } from '../ui/Button';

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
        <Button className="mobile-nav-trigger" variant="ghost" onClick={onOpenNavigation} aria-label="Open navigation">
          Menu
        </Button>
        <NavLink className="wordmark" to={isWorker ? '/worker/tools' : '/admin/dashboard'}>
          <BrandMark />
          <span>
            Nelson <em>Electric</em>
          </span>
        </NavLink>
      </div>
      <AccountMenu role={role} session={session} onSignOut={onSignOut} />
    </header>
  );
}
