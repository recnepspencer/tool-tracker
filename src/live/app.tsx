import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Link, NavLink, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Zap, Menu, X } from 'lucide-react';
import { SessionProvider, useSession, useCompany } from './session';
import { Login, Signup, VerifyEmail, Recovery, ResetPassword, CompanySetup, Invitation } from './auth';
import { Loading, Notice, Form } from './ui';
import { PwaStatus } from './pwa';

const ToolsPage = lazy(() => import('./tools').then((m) => ({ default: m.ToolsPage })));
const ToolDetail = lazy(() => import('./tools').then((m) => ({ default: m.ToolDetail })));
const RegisterTool = lazy(() => import('./tools').then((m) => ({ default: m.RegisterTool })));
const OperationsPage = lazy(() => import('./operations').then((m) => ({ default: m.OperationsPage })));
const ReconciliationsPage = lazy(() => import('./operations').then((m) => ({ default: m.ReconciliationsPage })));
const PeoplePage = lazy(() => import('./people').then((m) => ({ default: m.PeoplePage })));
const JobsPage = lazy(() => import('./jobs').then((m) => ({ default: m.JobsPage })));
const CatalogPage = lazy(() => import('./catalog').then((m) => ({ default: m.CatalogPage })));
const SettingsPage = lazy(() => import('./settings').then((m) => ({ default: m.SettingsPage })));
const ActivityPage = lazy(() => import('./settings').then((m) => ({ default: m.ActivityPage })));
const DirectoryPage = lazy(() => import('./settings').then((m) => ({ default: m.DirectoryPage })));

function RequireAccount() {
  const { session, loading, error, refresh } = useSession();
  const location = useLocation();
  if (loading) return <Loading />;
  if (error)
    return (
      <main className="connection-error">
        <h1>Can’t reach your workspace</h1>
        <Notice error>Check your connection and try again. Your account has not been signed out.</Notice>
        <Form label="Try again" submit={refresh}>
          <></>
        </Form>
      </main>
    );
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (!session.memberships.length) return <Navigate to="/company-setup" replace />;
  return <Outlet />;
}
function Permit({ capabilities }: { capabilities: string[] }) {
  const c = useCompany();
  return capabilities.every(c.can) ? (
    <Outlet />
  ) : (
    <Notice error>Your company permissions do not allow access to this page.</Notice>
  );
}
function Home() {
  const c = useCompany();
  return <Navigate to={c.can('tools.read') ? '/app/tools' : '/app/jobs'} replace />;
}
function Shell() {
  const { session, chooseCompany, logout } = useSession();
  const c = useCompany();
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const links = [
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
          <Zap /> Nelson Electric
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
          <Zap aria-hidden="true" /> Nelson Electric
        </Link>
        <label className="field">
          <span>Workspace</span>
          <select
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
        </label>
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
export function App() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, retry: false, networkMode: 'always' },
          mutations: { retry: false, networkMode: 'always' },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <SessionProvider>
        <BrowserRouter>
          <a className="skip-link" href="#main-content">
            Skip to content
          </a>
          <PwaStatus />
          <Routes>
            <Route path="/" element={<Navigate to="/app" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<Recovery />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/invite/:token" element={<Invitation />} />
            <Route path="/company-setup" element={<CompanySetup />} />
            <Route element={<RequireAccount />}>
              <Route path="/app" element={<Shell />}>
                <Route index element={<Home />} />
                <Route element={<Permit capabilities={['tools.read']} />}>
                  <Route path="tools" element={<ToolsPage />} />
                  <Route path="tools/new" element={<RegisterTool />} />
                  <Route path="tools/:assetId" element={<ToolDetail />} />
                  <Route path="operations" element={<OperationsPage />} />
                </Route>
                <Route element={<Permit capabilities={['jobs.read']} />}>
                  <Route path="jobs" element={<JobsPage />} />
                </Route>
                <Route element={<Permit capabilities={['tools.read', 'jobs.read']} />}>
                  <Route path="directory" element={<DirectoryPage />} />
                </Route>
                <Route element={<Permit capabilities={['people.manage']} />}>
                  <Route path="people" element={<PeoplePage />} />
                </Route>
                <Route element={<Permit capabilities={['catalog.manage']} />}>
                  <Route path="catalog" element={<CatalogPage />} />
                </Route>
                <Route element={<Permit capabilities={['reconciliation.manage']} />}>
                  <Route path="reconciliations" element={<ReconciliationsPage />} />
                </Route>
                <Route path="settings" element={<SettingsPage />} />
                <Route path="activity" element={<ActivityPage />} />
              </Route>
            </Route>
            <Route
              path="*"
              element={
                <main className="connection-error">
                  <h1>Page not found</h1>
                  <Link to="/app">Return to your workspace</Link>
                </main>
              }
            />
          </Routes>
        </BrowserRouter>
      </SessionProvider>
    </QueryClientProvider>
  );
}
