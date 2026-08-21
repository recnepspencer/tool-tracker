import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import type { AuthSession, Role } from '../../domain/auth';
import { AppHeader } from './AppHeader';
import { SidebarNav } from './SidebarNav';
import { MobileNavDrawer } from './MobileNavDrawer';
import { WorkerRoleShell } from './WorkerRoleShell';
import '../../styles/shell.css';

export interface RoleShellProps {
  role: Role;
  session: AuthSession;
  onSignOut(): void;
  theme: 'dark' | 'light';
  onToggleTheme(): void;
}

export function RoleShell({ role, session, onSignOut, theme, onToggleTheme }: RoleShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
          open={mobileNavOpen}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onClose={() => setMobileNavOpen(false)}
        />
        <main className="shell-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
