import { lazy } from 'react';
import { Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AppProviders } from './providers';
import { Shell } from './shell';

import { CompanySetup, Invitation, Login, Recovery, ResetPassword, Signup, VerifyEmail } from './auth';
import { PwaStatus } from './pwa';
import { useCompany, useSession } from './session';
import { Form, Loading, Notice } from './ui';

const InventoryPage = lazy(() => import('./field').then((m) => ({ default: m.InventoryPage })));
const MyToolsPage = lazy(() => import('./field').then((m) => ({ default: m.MyToolsPage })));
const CheckoutPage = lazy(() => import('./field').then((m) => ({ default: m.CheckoutPage })));
const ToolSheet = lazy(() => import('./field').then((m) => ({ default: m.ToolSheet })));
const WarehousesPage = lazy(() => import('./workspace-pages').then((m) => ({ default: m.WarehousesPage })));
const AccessPage = lazy(() => import('./workspace-pages').then((m) => ({ default: m.AccessPage })));
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
  return (
    <Navigate
      to={
        c.can('tools.manage') || c.managed_warehouse_ids.length
          ? '/app/operations'
          : c.can('tools.read')
            ? '/app/mine'
            : '/app/jobs'
      }
      replace
    />
  );
}
export function App() {
  return (
    <AppProviders>
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
              <Route path="tools" element={<InventoryPage />} />
              <Route path="flagged" element={<InventoryPage flagged />} />
              <Route path="mine" element={<MyToolsPage />} />
              <Route path="mine/:assetId" element={<ToolSheet field="mine" />} />
              <Route path="checkout" element={<CheckoutPage />} />
              <Route path="checkout/:assetId" element={<ToolSheet field="checkout" />} />
              <Route path="tools/new" element={<RegisterTool />} />
              <Route path="tools/:assetId" element={<ToolSheet />} />
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
              <Route path="access" element={<AccessPage />} />
            </Route>
            <Route element={<Permit capabilities={['catalog.manage']} />}>
              <Route path="catalog" element={<CatalogPage />} />
              <Route path="warehouses" element={<WarehousesPage />} />
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
    </AppProviders>
  );
}
