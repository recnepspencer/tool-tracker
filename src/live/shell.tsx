import { RecordSheet } from './experience/RecordSheet';
import { Suspense } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import {
  Activity,
  Boxes,
  BriefcaseBusiness,
  ClipboardList,
  Menu,
  Moon,
  PackageCheck,
  Plus,
  Settings,
  ShieldCheck,
  Sun,
  TriangleAlert,
  Users,
  Warehouse,
  Wrench,
  X,
} from 'lucide-react';
import { useCompany, useSession } from './session';
import { Form, Loading } from './ui';
import { useShellNavigation } from './shell-state';
import './experience/tokens.css';
import './experience/shell.css';
import './experience/WorkerRoleShell.css';
import './experience/worker.css';
import './experience/catalog.css';
import './experience/admin.css';
import './experience/admin-operations.css';
import './experience/admin-people.css';
import './experience/admin-warehouses.css';
import './experience/tool-detail.css';
import './experience/bridge.css';
import './experience/jobs.css';

export function Shell() {
  const { session, chooseCompany, logout, refresh } = useSession();
  const c = useCompany();
  const { menu, setMenu, theme, toggleTheme, accountOpen, setAccountOpen, navigationRef, navigateHome, canRegister } =
    useShellNavigation();
  const control =
    c.can('tools.manage') || c.can('people.manage') || c.can('jobs.manage') || c.managed_warehouse_ids.length > 0;
  const destinations = control
    ? ([
        ['Queue', '/app/operations', ClipboardList, c.can('tools.read')],
        ['Inventory', '/app/tools', Boxes, c.can('tools.read')],
        ['Damaged & lost', '/app/flagged', TriangleAlert, c.can('tools.read')],
        ['People', '/app/people', Users, c.can('people.manage')],
        ['Foremen', '/app/directory', BriefcaseBusiness, c.can('tools.read') && c.can('jobs.read')],
        [c.can('jobs.manage') ? 'Jobs' : 'My jobs', '/app/jobs', BriefcaseBusiness, c.can('jobs.read')],
        ['Warehouses', '/app/warehouses', Warehouse, c.can('catalog.manage')],
        ['Access', '/app/access', ShieldCheck, c.can('people.manage')],
        ['Activity', '/app/activity', Activity, true],
        [
          'Settings',
          '/app/settings',
          Settings,
          c.can('company.manage') || c.can('tools.manage_registration_policy') || c.can('jobs.manage_policy'),
        ],
      ] as const)
    : ([
        ['My tools', '/app/mine', Wrench, c.can('tools.read')],
        ['Checkout', '/app/checkout', PackageCheck, c.can('tools.read')],
        [c.can('jobs.participate') ? 'My jobs' : 'Jobs', '/app/jobs', BriefcaseBusiness, c.can('jobs.read')],
        ['Foremen', '/app/directory', Users, c.can('tools.read') && c.can('jobs.read')],
        ['Activity', '/app/activity', Activity, true],
      ] as const);
  const links = destinations
    .filter((entry) => entry[3])
    .map(([label, href, Icon]) => (
      <NavLink
        key={href}
        to={href}
        onClick={() => setMenu(false)}
        className={({ isActive }) =>
          control
            ? 'side-nav-link' + (isActive ? ' side-nav-link--active' : '')
            : 'worker-drawer-link' + (isActive ? ' worker-drawer-link--active' : '')
        }
      >
        <Icon size={18} aria-hidden="true" />
        {label}
      </NavLink>
    ));
  const appearance = (
    <button type="button" className="appearance-control" onClick={toggleTheme}>
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      {theme === 'dark' ? 'Light appearance' : 'Dark appearance'}
    </button>
  );
  const account = (
    <div className="experience-account">
      <strong>{c.preferred_name}</strong>
      <small>{session?.email}</small>
      <div className="field">
        <label htmlFor="workspace-company">Workspace</label>
        <select
          id="workspace-company"
          value={c.company_id}
          onChange={(event) => {
            chooseCompany(event.target.value);
            navigateHome();
            setMenu(false);
            setAccountOpen(false);
          }}
        >
          {session?.memberships.map((member) => (
            <option key={member.company_id} value={member.company_id}>
              {member.company_name}
            </option>
          ))}
        </select>
      </div>
      <Link to="/forgot-password">Change password</Link>
      <Form label="Refresh access" submit={refresh} successMessage="Access refreshed.">
        <></>
      </Form>
      <Form label="Sign out" submit={logout}>
        <></>
      </Form>
    </div>
  );
  return (
    <div className="experience" data-theme={theme}>
      <div className={control ? 'control-app-shell' : 'worker-app-shell'}>
        <header className={control ? 'app-header' : 'worker-topbar'}>
          <div className="header-leading">
            <button
              type="button"
              className={control ? 'worker-menu-button control-menu-button' : 'worker-menu-button'}
              aria-label={menu ? 'Close navigation' : 'Open navigation'}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X size={18} /> : <Menu size={18} />}
            </button>
            {control && (
              <Link className="wordmark" to="/app">
                <span className="control-brand-mark">N</span>
                <span>
                  Nelson <em>Electric</em>
                </span>
              </Link>
            )}
          </div>
          {control ? (
            <button className="control-account-label" aria-label="Open account" onClick={() => setAccountOpen(true)}>
              {c.preferred_name}
              <span className="session-avatar">{c.preferred_name.slice(0, 1)}</span>
            </button>
          ) : (
            <Link className="worker-wordmark" to="/app/mine">
              NELSON ELECTRIC
            </Link>
          )}
        </header>
        <div className={control ? 'shell-body' : 'worker-shell-body'}>
          {control && (
            <aside className="side-nav">
              <div className="side-nav-heading">Control room</div>
              <nav className="side-nav-links" aria-label="Company navigation">
                {links}
              </nav>
              <div className="side-nav-theme">{appearance}</div>
              <small className="side-nav-footer">Nelson Electric · Tools & custody</small>
            </aside>
          )}
          <main id="main-content" className={control ? 'shell-main' : 'worker-main'} key={c.company_id}>
            <Suspense fallback={<Loading />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
        {accountOpen && (
          <RecordSheet title="Your account" onClose={() => setAccountOpen(false)}>
            <h1>Your account</h1>
            {account}
          </RecordSheet>
        )}
        {menu && (
          <div className="worker-navigation-layer">
            <button className="worker-scrim" aria-label="Close navigation backdrop" onClick={() => setMenu(false)} />
            <aside
              ref={navigationRef}
              className="worker-navigation-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
            >
              <div className="worker-drawer-header">
                <button className="worker-close-button" aria-label="Close navigation" onClick={() => setMenu(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className="worker-drawer-profile">
                <span className="session-avatar">{c.preferred_name.slice(0, 1)}</span>
                <strong>{c.preferred_name}</strong>
              </div>
              <nav>{links}</nav>
              {canRegister && (
                <Link className="worker-drawer-link" to="/app/tools/new" onClick={() => setMenu(false)}>
                  <Plus size={18} />
                  Add tool
                </Link>
              )}
              {appearance}
              {account}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
