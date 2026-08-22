import { Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { AuthSession, Role } from '../../domain/auth';
import { AppHeader } from './AppHeader';
import { SidebarNav } from './SidebarNav';
import { MobileNavDrawer } from './MobileNavDrawer';
import { WorkerRoleShell } from './WorkerRoleShell';
import { WorkerAccountSheet } from './WorkerAccountSheet';
import '../../styles/shell.css';

export interface RoleShellProps {
  role: Role;
  session: AuthSession;
  onSignOut(): void;
  theme: 'dark' | 'light';
  onToggleTheme(): void;
}

export function RoleShell({ role, session, onSignOut, theme, onToggleTheme }: RoleShellProps) {
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
    setAccountOpen(false);
  }, [location.pathname]);

  if (role === 'worker') {
    return <WorkerRoleShell session={session} onSignOut={onSignOut} theme={theme} onToggleTheme={onToggleTheme} />;
  }

  return (
    <div className="app-shell">
      <AppHeader role={role} session={session} onSignOut={onSignOut} onOpenNavigation={() => setMobileNavOpen(true)} />
      <div className="shell-body">
        <SidebarNav role={role} theme={theme} onToggleTheme={onToggleTheme} />
        <MobileNavDrawer
          role={role}
          session={session}
          open={mobileNavOpen}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onClose={() => setMobileNavOpen(false)}
          onOpenAccount={() => {
            setMobileNavOpen(false);
            setAccountOpen(true);
          }}
        />
        <main className="shell-main">
          <Outlet />
        </main>
      </div>
      <WorkerAccountSheet
        open={accountOpen}
        session={session}
        onSignOut={onSignOut}
        onClose={() => setAccountOpen(false)}
      />
    </div>
  );
}
