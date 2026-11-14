import { Suspense } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { LoadingState } from './kit';
import { useCompany } from './session';
import { AccountMenu } from './shell-account';
import { CompanyMark } from './company-mark';
import { ShellNavItems, TabBar } from './shell-chrome';
import { MenuScreen } from './shell-menu';
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
import './experience/menu.css';
import './experience/design-system.css';

export function Shell() {
  const c = useCompany();
  const shell = useShellNavigation();
  const { control, settings, destinations } = useShellDestinations();
  const account = useShellAccount(shell.closeAll);
  const appearance = { theme: shell.theme, onToggleTheme: shell.toggleTheme };
  const content = (
    <main id="main-content" className={control ? 'shell-main' : 'worker-main'} key={c.company_id}>
      <Suspense fallback={<LoadingState />}>
        <Outlet />
      </Suspense>
    </main>
  );
  // Phones get a labelled tab bar; its Menu holds every page and the account.
  const phoneChrome = (
    <>
      <TabBar destinations={destinations} menuOpen={shell.menu} onMenu={shell.setMenu} />
      {shell.menu && (
        <MenuScreen
          account={account}
          destinations={destinations}
          control={control}
          settings={settings}
          {...appearance}
          onClose={() => shell.setMenu(false)}
        />
      )}
    </>
  );
  if (!control)
    return (
      <div className="worker-app-shell">
        {content}
        {phoneChrome}
      </div>
    );
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link className="wordmark" to="/app">
          <CompanyMark logoId={account.logoId} name={account.companyName} />
        </Link>
        <div className="desktop-header-account">
          <AccountMenu
            account={account}
            open={shell.accountOpen}
            settings={settings}
            {...appearance}
            onOpenChange={shell.setAccountOpen}
          />
        </div>
      </header>
      <div className="shell-body">
        <aside className="side-nav" aria-label="Main">
          <nav className="side-nav-links" aria-label="Main navigation">
            <ShellNavItems destinations={destinations} />
          </nav>
        </aside>
        {content}
      </div>
      {phoneChrome}
    </div>
  );
}
