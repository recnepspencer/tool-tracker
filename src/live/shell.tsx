import { Menu, X } from 'lucide-react';
import { Suspense } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useCompany, useSession } from './session';
import { useShellNavigation } from './shell-state';
import { Form, Loading } from './ui';
export function Shell() {
  const { session, chooseCompany, logout } = useSession();
  const c = useCompany();
  const { menu, setMenu } = useShellNavigation();
  const links = [
    ['Overview', '/app/overview', c.can('activity.read')],
    ['Tools', '/app/tools', c.can('tools.read')],
    ['Requests & handoffs', '/app/operations', c.can('tools.read')],
    ['Jobs', '/app/jobs', c.can('jobs.read')],
    ['Team directory', '/app/directory', c.can('tools.read') && c.can('jobs.read')],
    ['People', '/app/people', c.can('people.manage')],
    ['Catalog & warehouses', '/app/catalog', c.can('catalog.manage')],
    ['Reconciliation', '/app/reconciliations', c.can('reconciliation.manage')],
    ['Activity', '/app/activity', true],
    ['Company rules', '/app/settings', c.can('tools.manage_registration_policy') || c.can('jobs.manage_policy')],
  ] as const;
  return (
    <div className="app-shell">
      <header className="mobile-header">
        <Link className="brand" to="/app">
          <span className="auth-monogram" aria-hidden="true">
            N
          </span>{' '}
          Nelson Electric
        </Link>
        <button
          aria-label={menu ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X /> : <Menu />}
        </button>
      </header>
      <aside className={`sidebar ${menu ? 'open' : ''}`}>
        <Link className="brand" to="/app">
          <span className="auth-monogram" aria-hidden="true">
            N
          </span>{' '}
          Nelson Electric
        </Link>
        <div className="field">
          <label htmlFor="workspace-company">Workspace</label>
          <select
            id="workspace-company"
            value={c.company_id}
            onChange={(e) => {
              chooseCompany(e.target.value);
              setMenu(false);
            }}
          >
            {session?.memberships.map((m) => (
              <option key={m.company_id} value={m.company_id}>
                {m.company_name}
              </option>
            ))}
          </select>
        </div>
        <nav aria-label="Main navigation">
          {links
            .filter((l) => l[2])
            .map(([label, path]) => (
              <NavLink key={path} to={path} onClick={() => setMenu(false)}>
                {label}
              </NavLink>
            ))}
        </nav>
        <div className="sidebar-account">
          <strong>{c.preferred_name}</strong>
          <small>{session?.email}</small>
          <Form label="Sign out" submit={logout}>
            <></>
          </Form>
          <Link to="/forgot-password">Change password</Link>
        </div>
      </aside>
      <main id="main-content" className="workspace" key={c.company_id}>
        <Suspense fallback={<Loading />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
