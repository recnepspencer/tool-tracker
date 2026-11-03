import { Suspense } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { LoadingState } from './kit';
import { useCompany } from './session';
import { AccountMenu, AccountSheet } from './shell-account';
import { CompanyMark } from './company-mark';
import { ShellNavigationDrawer, ShellNavItems, ThemeToggle } from './shell-chrome';
import { useShellAccount, useShellDestinations, useShellNavigation } from './shell-state';
// Stylesheets follow the demo's cascade order: equal-specificity ties resolve the same way.
import './kit';
import './experience/account.css';
import './experience/tool-detail.css';
import './experience/activity-indicator.css';
import './experience/custody.css';
import './experience/worker.css';
import './experience/catalog.css';
import './experience/activity.css';
import './experience/admin-people.css';
import './experience/permissions.css';
import './experience/admin-warehouses.css';
import './experience/admin-operations.css';
import './experience/admin-activity.css';
import './experience/jobs.css';
import './experience/admin-settings.css';
import './experience/account-menu.css';
import './experience/theme-toggle.css';
import './experience/WorkerRoleShell.css';
import './experience/add-tool.css';
import './experience/shell.css';
import './experience/admin.css';

export function Shell() {
  const c = useCompany();
  const shell = useShellNavigation();
  const { control, settings, destinations } = useShellDestinations();
  const account = useShellAccount(shell.closeAll);
  const content = (
    <main id="main-content" className={control ? 'shell-main' : 'worker-main'} key={c.company_id}>
      <Suspense fallback={<LoadingState />}>
        <Outlet />
      </Suspense>
    </main>
  );
  const drawer = shell.menu && (
    <ShellNavigationDrawer
      label={control ? 'Admin navigation' : 'Worker navigation'}
      drawerRef={shell.navigationRef}
      name={account.name}
      title={account.title}
      destinations={destinations}
      addToolPath={!control && shell.canRegister ? '/app/mine/new' : undefined}
      theme={shell.theme}
      onToggleTheme={shell.toggleTheme}
      onClose={() => shell.setMenu(false)}
      onOpenAccount={shell.openAccountSheet}
    />
  );
  const sheet = (
    <AccountSheet
      account={account}
      open={shell.accountSheetOpen}
      settings={settings}
      onClose={shell.closeAccountSheet}
    />
  );
  if (!control)
    return (
      <div className="worker-app-shell">
        <header className="worker-topbar">
          <button
            type="button"
            className="worker-menu-button"
            aria-label="Open navigation"
            aria-expanded={shell.menu}
            onClick={() => shell.setMenu(true)}
          >
            <Menu aria-hidden="true" />
          </button>
          <Link className="worker-wordmark" to="/app">
            {account.companyName}
          </Link>
        </header>
        {content}
        {drawer}
        {sheet}
      </div>
    );
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-leading">
          <button
            type="button"
            className="mobile-nav-trigger worker-menu-button"
            aria-label="Open navigation"
            aria-expanded={shell.menu}
            onClick={() => shell.setMenu(true)}
          >
            <Menu aria-hidden="true" />
          </button>
          <Link className="wordmark" to="/app">
            <CompanyMark logoId={account.logoId} name={account.companyName} />
            <span className="mobile-wordmark-copy">{account.companyName}</span>
          </Link>
        </div>
        <div className="desktop-header-account">
          <AccountMenu
            account={account}
            open={shell.accountOpen}
            settings={settings}
            onOpenChange={shell.setAccountOpen}
          />
        </div>
      </header>
      <div className="shell-body">
        <aside className="side-nav" aria-label="Control room navigation">
          <div className="side-nav-heading">Control room</div>
          <nav className="side-nav-links" aria-label="Control room destinations">
            <ShellNavItems destinations={destinations} />
          </nav>
          <div className="side-nav-theme">
            <ThemeToggle theme={shell.theme} onToggleTheme={shell.toggleTheme} />
          </div>
          <div className="side-nav-footer">
            <span className="eyebrow">Tool Tracker</span>
            <span>Tools · custody · activity</span>
          </div>
        </aside>
        {drawer}
        {content}
      </div>
      {sheet}
    </div>
  );
}
