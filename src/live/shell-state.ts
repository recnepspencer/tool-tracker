import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Boxes,
  BriefcaseBusiness,
  ClipboardList,
  HardHat,
  Library,
  PackageCheck,
  Users,
  Warehouse,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useAppearance } from './appearance';
import { errorMessage } from './client';
import { usePeople } from './data';
import { ROLE_LABELS } from './people-roles';
import { useCompany, useSession } from './session';

export interface ShellDestination {
  label: string;
  path: string;
  icon: LucideIcon;
  /** Pages reached from this one, which keep it highlighted. */
  also?: string[];
}

/** The navigation entries for the signed-in membership, mirroring the demo's NavItems. */
export function useShellDestinations() {
  const c = useCompany();
  const control =
    c.can('tools.manage') || c.can('people.manage') || c.can('jobs.manage') || c.managed_warehouse_ids.length > 0;
  const settings = c.can('company.manage') || c.can('tools.manage_registration_policy') || c.can('jobs.manage_policy');
  // Related pages share one entry: Damaged & lost and Reconciliation are reached from the Queue,
  // and role permissions from People. Settings is listed in Menu and the desktop account menu.
  const entries: Array<ShellDestination & { enabled: boolean }> = control
    ? [
        {
          label: 'Queue',
          path: '/app/operations',
          icon: ClipboardList,
          enabled: c.can('tools.read'),
          also: ['/app/flagged', '/app/reconciliations'],
        },
        { label: 'Inventory', path: '/app/tools', icon: Boxes, enabled: c.can('tools.read') },
        // Managers and admins carry tools too, so they keep the same view of what they hold.
        { label: 'My tools', path: '/app/mine', icon: Wrench, enabled: c.can('tools.read') },
        {
          label: c.can('jobs.manage') ? 'Jobs' : 'My jobs',
          path: '/app/jobs',
          icon: BriefcaseBusiness,
          enabled: c.can('jobs.read'),
        },
        { label: 'People', path: '/app/people', icon: Users, enabled: c.can('people.manage'), also: ['/app/access'] },
        {
          label: 'Foremen',
          path: '/app/directory',
          icon: HardHat,
          enabled: c.can('tools.read') && c.can('jobs.read'),
        },
        { label: 'Warehouses', path: '/app/warehouses', icon: Warehouse, enabled: c.can('catalog.manage') },
        { label: 'Catalog', path: '/app/catalog', icon: Library, enabled: c.can('catalog.manage') },
        { label: 'Activity', path: '/app/activity', icon: Activity, enabled: true },
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
          icon: HardHat,
          enabled: c.can('tools.read') && c.can('jobs.read'),
        },
        { label: 'Activity', path: '/app/activity', icon: Activity, enabled: true },
      ];
  return {
    control,
    settings,
    destinations: entries
      .filter((entry) => entry.enabled)
      .map(({ label, path, icon, also }) => ({ label, path, icon, also })),
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
  const title = person?.title || (person ? ROLE_LABELS[person.role] : '') || '';
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
  const location = useLocation();
  // Each overlay remembers the path it opened on, so navigating closes it
  // without a synchronizing effect.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [accountPath, setAccountPath] = useState<string | null>(null);
  const menu = openPath === location.pathname;
  const { theme, toggleTheme } = useAppearance();
  // The open menu owns the viewport.
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
    menu,
    setMenu: (open: boolean) => setOpenPath(open ? location.pathname : null),
    /** The desktop account menu in the control-room header. */
    accountOpen: accountPath === location.pathname,
    setAccountOpen: (open: boolean) => setAccountPath(open ? location.pathname : null),
    closeAll: () => {
      setOpenPath(null);
      setAccountPath(null);
    },
    theme,
    toggleTheme,
  };
}
