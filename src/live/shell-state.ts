import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Boxes,
  BriefcaseBusiness,
  ClipboardCheck,
  ClipboardList,
  Library,
  PackageCheck,
  Settings,
  ShieldCheck,
  TriangleAlert,
  Users,
  Warehouse,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useAppearance } from './appearance';
import { errorMessage } from './client';
import { usePeople } from './data';
import { useModalFocusTrap } from './experience/use-modal-focus-trap';
import { useRegistrationPolicy } from './registration-policy';
import { useCompany, useSession } from './session';

export interface ShellDestination {
  label: string;
  path: string;
  icon: LucideIcon;
}

const roleLabels: Record<string, string> = {
  company_admin: 'Company admin',
  equipment_manager: 'Equipment manager',
  dispatcher: 'Dispatcher',
  estimator: 'Estimator',
  field_member: 'Field crew',
};

/** The navigation entries for the signed-in membership, mirroring the demo's NavItems. */
export function useShellDestinations() {
  const c = useCompany();
  const control =
    c.can('tools.manage') || c.can('people.manage') || c.can('jobs.manage') || c.managed_warehouse_ids.length > 0;
  const settings = c.can('company.manage') || c.can('tools.manage_registration_policy') || c.can('jobs.manage_policy');
  const entries: Array<ShellDestination & { enabled: boolean }> = control
    ? [
        { label: 'Queue', path: '/app/operations', icon: ClipboardList, enabled: c.can('tools.read') },
        { label: 'Inventory', path: '/app/tools', icon: Boxes, enabled: c.can('tools.read') },
        { label: 'Damaged & lost', path: '/app/flagged', icon: TriangleAlert, enabled: c.can('tools.read') },
        {
          label: 'Reconciliation',
          path: '/app/reconciliations',
          icon: ClipboardCheck,
          enabled: c.can('reconciliation.manage'),
        },
        { label: 'People', path: '/app/people', icon: Users, enabled: c.can('people.manage') },
        {
          label: 'Foremen',
          path: '/app/directory',
          icon: BriefcaseBusiness,
          enabled: c.can('tools.read') && c.can('jobs.read'),
        },
        {
          label: c.can('jobs.manage') ? 'Jobs' : 'My jobs',
          path: '/app/jobs',
          icon: BriefcaseBusiness,
          enabled: c.can('jobs.read'),
        },
        { label: 'Warehouses', path: '/app/warehouses', icon: Warehouse, enabled: c.can('catalog.manage') },
        { label: 'Catalog', path: '/app/catalog', icon: Library, enabled: c.can('catalog.manage') },
        { label: 'Access', path: '/app/access', icon: ShieldCheck, enabled: c.can('people.manage') },
        { label: 'Activity', path: '/app/activity', icon: Activity, enabled: true },
        { label: 'Settings', path: '/app/settings', icon: Settings, enabled: settings },
      ]
    : [
        { label: 'My tools', path: '/app/mine', icon: Wrench, enabled: c.can('tools.read') },
        { label: 'Checkout', path: '/app/checkout', icon: PackageCheck, enabled: c.can('tools.read') },
        {
          label: c.can('jobs.participate') ? 'My jobs' : 'Jobs',
          path: '/app/jobs',
          icon: BriefcaseBusiness,
          enabled: c.can('jobs.read'),
        },
        {
          label: 'Foremen',
          path: '/app/directory',
          icon: Users,
          enabled: c.can('tools.read') && c.can('jobs.read'),
        },
        { label: 'Activity', path: '/app/activity', icon: Activity, enabled: true },
      ];
  return {
    control,
    settings,
    destinations: entries.filter((entry) => entry.enabled).map(({ label, path, icon }) => ({ label, path, icon })),
  };
}

/** Identity, workspace switching and session commands shown in both account sheets. */
export function useShellAccount(onWorkspaceChange: () => void) {
  const { session, chooseCompany, logout, refresh } = useSession();
  const c = useCompany();
  const navigate = useNavigate();
  const people = usePeople();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const person = people.data?.find((item) => item.id === c.membership_id);
  const title = person?.title || (person ? roleLabels[person.roles[0] ?? ''] : '') || '';
  return {
    name: c.preferred_name,
    title,
    email: session?.email ?? '',
    companyId: c.company_id,
    companyName: c.company_name,
    logoId: c.company_logo_id,
    workspaces: (session?.memberships ?? []).map((member) => ({
      value: member.company_id,
      label: member.company_name,
    })),
    chooseWorkspace: (companyId: string) => {
      if (companyId === c.company_id) return;
      chooseCompany(companyId);
      onWorkspaceChange();
      navigate('/app');
    },
    refreshing,
    refreshError,
    refreshAccess: async () => {
      if (refreshing) return;
      setRefreshing(true);
      setRefreshError('');
      try {
        await refresh();
      } catch (error) {
        setRefreshError(errorMessage(error));
      } finally {
        setRefreshing(false);
      }
    },
    signOut: () => void logout(),
  };
}

export function useShellNavigation() {
  const { canRegister } = useRegistrationPolicy();
  const location = useLocation();
  // Each overlay remembers the path it opened on, so navigating closes it
  // without a synchronizing effect.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [accountPath, setAccountPath] = useState<string | null>(null);
  const [sheetPath, setSheetPath] = useState<string | null>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const menu = openPath === location.pathname;
  useModalFocusTrap(menu, () => setOpenPath(null), navigationRef);
  const { theme, toggleTheme } = useAppearance();
  // The open drawer owns the viewport, as in the demo's navigation drawers.
  useEffect(() => {
    if (!menu) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menu]);
  // Scrolling synchronizes a browser API with navigation; no derived state effect.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return {
    canRegister,
    menu,
    navigationRef,
    setMenu: (open: boolean) => setOpenPath(open ? location.pathname : null),
    /** The desktop account menu in the control-room header. */
    accountOpen: accountPath === location.pathname,
    setAccountOpen: (open: boolean) => setAccountPath(open ? location.pathname : null),
    /** The bottom account sheet opened from the navigation drawer profile. */
    accountSheetOpen: sheetPath === location.pathname,
    openAccountSheet: () => {
      setOpenPath(null);
      setSheetPath(location.pathname);
    },
    closeAccountSheet: () => setSheetPath(null),
    closeAll: () => {
      setOpenPath(null);
      setAccountPath(null);
      setSheetPath(null);
    },
    theme,
    toggleTheme,
  };
}
