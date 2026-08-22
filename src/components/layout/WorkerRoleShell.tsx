import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import type { AuthSession } from '../../domain/auth';
import { AddToolWizard } from '../../features/add-tool/AddToolWizard';
import { WorkerShellActionsProvider } from './WorkerShellContext';
import { WorkerAccountSheet } from './WorkerAccountSheet';
import { WorkerNavigationDrawer } from './WorkerNavigationDrawer';
import './WorkerRoleShell.css';

interface WorkerRoleShellProps {
  session: AuthSession;
  onSignOut(): void;
  theme: 'dark' | 'light';
  onToggleTheme(): void;
}

export function WorkerRoleShell({ session, onSignOut, theme, onToggleTheme }: WorkerRoleShellProps) {
  const location = useLocation();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [addToolOpen, setAddToolOpen] = useState(false);

  useEffect(() => {
    setNavigationOpen(false);
    setAccountOpen(false);
  }, [location.pathname]);

  const openAddTool = () => {
    setNavigationOpen(false);
    setAddToolOpen(true);
  };

  return (
    <WorkerShellActionsProvider value={{ openAddTool }}>
      <div className="worker-app-shell">
        <header className="worker-topbar">
          <button
            type="button"
            className="worker-menu-button"
            aria-label="Open navigation"
            onClick={() => setNavigationOpen(true)}
          >
            <Menu aria-hidden="true" />
          </button>
          <Link className="worker-wordmark" to="/worker/tools">
            NELSON ELECTRIC
          </Link>
        </header>
        <main className="worker-main">
          <Outlet />
        </main>
        <WorkerNavigationDrawer
          open={navigationOpen}
          session={session}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onClose={() => setNavigationOpen(false)}
          onOpenAddTool={openAddTool}
          onOpenAccount={() => {
            setNavigationOpen(false);
            setAccountOpen(true);
          }}
        />
        <WorkerAccountSheet
          open={accountOpen}
          session={session}
          onSignOut={onSignOut}
          onClose={() => setAccountOpen(false)}
        />
        {addToolOpen ? <AddToolWizard onClose={() => setAddToolOpen(false)} /> : null}
      </div>
    </WorkerShellActionsProvider>
  );
}
