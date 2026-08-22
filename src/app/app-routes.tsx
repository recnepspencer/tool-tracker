import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/login/LoginPage';
import { SignupPage } from '../features/auth/onboarding/SignupPage';
import { CompanySetupPage } from '../features/auth/onboarding/CompanySetupPage';
import { InviteAcceptancePage } from '../features/auth/invitation/InviteAcceptancePage';
import { PasswordRecoveryPage } from '../features/auth/recovery/PasswordRecoveryPage';
import { WorkerToolsPage } from '../features/worker-tools/WorkerToolsPage';
import { CheckoutPage } from '../features/worker-catalog/CheckoutPage';
import { WorkerActivityPage } from '../features/worker-activity/WorkerActivityPage';
import { AdminDashboardPage } from '../features/admin-dashboard/AdminDashboardPage';
import { PeoplePage } from '../features/admin-people/PeoplePage';
import { PermissionsPage } from '../features/admin-permissions/PermissionsPage';
import { WarehousesPage } from '../features/admin-warehouses/WarehousesPage';
import { WarehouseQueuePage } from '../features/admin-operations/WarehouseQueuePage';
import { WarehouseInventoryPage } from '../features/admin-operations/WarehouseInventoryPage';
import { FlaggedToolsPage } from '../features/admin-operations/FlaggedToolsPage';
import { AdminActivityPage } from '../features/admin-activity/AdminActivityPage';
import { ReconciliationPage } from '../features/admin-reconciliation/ReconciliationPage';
import { SettingsPage } from '../features/admin-settings/SettingsPage';
import { WorkerShell } from './WorkerShell';
import { AdminShell } from './AdminShell';
import { RequireAnonymous, RequireRole, RequireSession } from './route-guards';
import { RouteScrollRestoration } from './RouteScrollRestoration';

export function AppRoutes() {
  return (
    <HashRouter>
      <RouteScrollRestoration />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route element={<RequireAnonymous />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/company-setup" element={<CompanySetupPage />} />
          <Route path="/invite/:token" element={<InviteAcceptancePage />} />
          <Route path="/reset-password" element={<PasswordRecoveryPage />} />
        </Route>
        <Route element={<RequireSession />}>
          <Route element={<RequireRole role="worker" />}>
            <Route element={<WorkerShell />}>
              <Route path="/worker" element={<Navigate to="/worker/tools" replace />} />
              <Route path="/worker/tools" element={<WorkerToolsPage />} />
              <Route path="/worker/checkout" element={<CheckoutPage />} />
              <Route path="/worker/activity" element={<WorkerActivityPage />} />
            </Route>
          </Route>
          <Route element={<RequireRole role="admin" />}>
            <Route element={<AdminShell />}>
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
              <Route path="/admin/people" element={<PeoplePage />} />
              <Route path="/admin/people/:personId" element={<PeoplePage />} />
              <Route path="/admin/permissions" element={<PermissionsPage />} />
              <Route path="/admin/warehouses" element={<WarehousesPage />} />
              <Route path="/admin/operations/queue" element={<WarehouseQueuePage />} />
              <Route path="/admin/operations/inventory" element={<WarehouseInventoryPage />} />
              <Route path="/admin/operations/flagged" element={<FlaggedToolsPage />} />
              <Route path="/admin/activity" element={<AdminActivityPage />} />
              <Route path="/admin/reconciliation" element={<ReconciliationPage />} />
              <Route path="/admin/settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  );
}
