import {
  Activity,
  Boxes,
  ClipboardList,
  GitMerge,
  PackageCheck,
  Settings,
  ShieldCheck,
  TriangleAlert,
  Users,
  Warehouse,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import type { Role } from '../../domain/auth';

const navByRole: Record<Role, Array<{ label: string; path: string; enabled: boolean; icon: LucideIcon }>> = {
  worker: [
    { label: 'My tools', path: '/worker/tools', enabled: true, icon: Wrench },
    { label: 'Checkout', path: '/worker/checkout', enabled: true, icon: PackageCheck },
    { label: 'Activity', path: '/worker/activity', enabled: true, icon: Activity },
  ],
  admin: [
    { label: 'Queue', path: '/admin/operations/queue', enabled: true, icon: ClipboardList },
    { label: 'Inventory', path: '/admin/operations/inventory', enabled: true, icon: Boxes },
    { label: 'Damaged & lost', path: '/admin/operations/flagged', enabled: true, icon: TriangleAlert },
    { label: 'People', path: '/admin/people', enabled: true, icon: Users },
    { label: 'Warehouses', path: '/admin/warehouses', enabled: true, icon: Warehouse },
    { label: 'Access', path: '/admin/permissions', enabled: true, icon: ShieldCheck },
    { label: 'Reconciliation', path: '/admin/reconciliation', enabled: true, icon: GitMerge },
    { label: 'Activity', path: '/admin/activity', enabled: true, icon: Activity },
    { label: 'Settings', path: '/admin/settings', enabled: true, icon: Settings },
  ],
};

export function NavItems({
  role,
  onNavigate,
  variant = 'sidebar',
}: {
  role: Role;
  onNavigate?(): void;
  variant?: 'sidebar' | 'drawer';
}) {
  return (
    <>
      {navByRole[role].map((item) => {
        const Icon = item.icon;
        return item.enabled ? (
          <NavLink
            key={item.label}
            to={item.path}
            onClick={onNavigate}
            className={({ isActive }) =>
              variant === 'drawer'
                ? `worker-drawer-link${isActive ? ' worker-drawer-link--active' : ''}`
                : `side-nav-link${isActive ? ' side-nav-link--active' : ''}`
            }
          >
            {variant === 'drawer' ? (
              <Icon className="worker-drawer-link-icon" aria-hidden="true" />
            ) : (
              <span className="nav-dot" />
            )}
            {item.label}
          </NavLink>
        ) : (
          <span key={item.label} className="side-nav-link side-nav-link--soon" aria-disabled="true">
            <span className="nav-dot" />
            {item.label}
            <small>Next</small>
          </span>
        );
      })}
    </>
  );
}
