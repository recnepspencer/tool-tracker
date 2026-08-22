import { NavLink } from 'react-router-dom';
import type { Role } from '../../domain/auth';

const navByRole: Record<Role, Array<{ label: string; path: string; enabled: boolean }>> = {
  worker: [
    { label: 'My tools', path: '/worker/tools', enabled: true },
    { label: 'Checkout', path: '/worker/checkout', enabled: true },
    { label: 'Activity', path: '/worker/activity', enabled: true },
  ],
  admin: [
    { label: 'Dashboard', path: '/admin/dashboard', enabled: true },
    { label: 'Queue', path: '/admin/operations/queue', enabled: true },
    { label: 'Inventory', path: '/admin/operations/inventory', enabled: true },
    { label: 'Damaged & lost', path: '/admin/operations/flagged', enabled: true },
    { label: 'People', path: '/admin/people', enabled: true },
    { label: 'Warehouses', path: '/admin/warehouses', enabled: true },
    { label: 'Access', path: '/admin/permissions', enabled: true },
    { label: 'Reconciliation', path: '/admin/reconciliation', enabled: true },
    { label: 'Activity', path: '/admin/activity', enabled: true },
    { label: 'Settings', path: '/admin/settings', enabled: true },
  ],
};

export function NavItems({ role, onNavigate }: { role: Role; onNavigate?(): void }) {
  return (
    <>
      {navByRole[role].map((item) =>
        item.enabled ? (
          <NavLink
            key={item.label}
            to={item.path}
            onClick={onNavigate}
            className={({ isActive }) => `side-nav-link${isActive ? ' side-nav-link--active' : ''}`}
          >
            <span className="nav-dot" />
            {item.label}
          </NavLink>
        ) : (
          <span key={item.label} className="side-nav-link side-nav-link--soon" aria-disabled="true">
            <span className="nav-dot" />
            {item.label}
            <small>Next</small>
          </span>
        ),
      )}
    </>
  );
}
