import type { RefObject } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { Switch } from './kit';
import { initials } from './format';
import type { ShellDestination } from './shell-state';

/** Demo ThemeToggle: the Appearance switch in the side nav and drawers. */
export function ThemeToggle({ theme, onToggleTheme }: { theme: 'dark' | 'light'; onToggleTheme(): void }) {
  return (
    <div className="theme-toggle theme-toggle--navigation">
      <Switch
        label="Appearance"
        description={theme === 'light' ? 'Light' : 'Dark'}
        checked={theme === 'light'}
        onCheckedChange={onToggleTheme}
      />
    </div>
  );
}

/** Demo NavItems in its sidebar and drawer variants. */
export function ShellNavItems({
  destinations,
  variant = 'sidebar',
  onNavigate,
}: {
  destinations: ShellDestination[];
  variant?: 'sidebar' | 'drawer';
  onNavigate?(): void;
}) {
  return (
    <>
      {destinations.map(({ label, path, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          onClick={onNavigate}
          className={({ isActive }) =>
            variant === 'drawer'
              ? `worker-drawer-link${isActive ? ' worker-drawer-link--active' : ''}`
              : `side-nav-link${isActive ? ' side-nav-link--active' : ''}`
          }
        >
          <Icon className={variant === 'drawer' ? 'worker-drawer-link-icon' : 'side-nav-icon'} aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </>
  );
}

/**
 * Demo MobileNavDrawer (control room) and WorkerNavigationDrawer (field):
 * profile button, links, the optional "Add a tool" action and Appearance.
 */
export function ShellNavigationDrawer({
  label,
  drawerRef,
  name,
  title,
  destinations,
  addToolPath,
  theme,
  onToggleTheme,
  onClose,
  onOpenAccount,
}: {
  label: string;
  drawerRef: RefObject<HTMLElement>;
  name: string;
  title: string;
  destinations: ShellDestination[];
  addToolPath?: string;
  theme: 'dark' | 'light';
  onToggleTheme(): void;
  onClose(): void;
  onOpenAccount(): void;
}) {
  return (
    <div className="worker-navigation-layer" role="presentation">
      <button type="button" className="worker-scrim" aria-label="Close navigation backdrop" onClick={onClose} />
      <aside ref={drawerRef} className="worker-navigation-drawer" role="dialog" aria-modal="true" aria-label={label}>
        <div className="worker-drawer-header">
          <button type="button" className="worker-close-button" aria-label="Close navigation" onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          className="worker-drawer-profile"
          aria-label={`Open account for ${name}`}
          onClick={onOpenAccount}
        >
          <span className="worker-avatar">{initials(name)}</span>
          <div>
            <strong>{name}</strong>
            <span>{title}</span>
          </div>
        </button>
        <nav className="worker-drawer-nav" aria-label={`${label} links`}>
          <ShellNavItems destinations={destinations} variant="drawer" onNavigate={onClose} />
          {addToolPath && (
            <Link className="worker-drawer-link worker-drawer-link--accent" to={addToolPath} onClick={onClose}>
              <Plus className="worker-drawer-link-icon" aria-hidden="true" />
              <span>Add a tool</span>
            </Link>
          )}
        </nav>
        <div className="worker-drawer-theme">
          <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} />
        </div>
      </aside>
    </div>
  );
}
