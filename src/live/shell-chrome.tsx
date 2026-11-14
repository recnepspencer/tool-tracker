import { NavLink, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Switch } from './kit';
import type { ShellDestination } from './shell-state';

/** Destinations the tab bar names; the fifth slot is always Menu. */
const TAB_COUNT = 4;

/** The Appearance switch in the account menus. */
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

export function useIsCurrent() {
  const { pathname } = useLocation();
  return ({ path, also = [] }: ShellDestination) =>
    [path, ...also].some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

/** Links in the desktop sidebar. */
export function ShellNavItems({ destinations }: { destinations: ShellDestination[] }) {
  const current = useIsCurrent();
  return (
    <>
      {destinations.map((destination) => {
        const { label, path, icon: Icon } = destination;
        const active = current(destination);
        return (
          <NavLink
            key={path}
            to={path}
            aria-current={active ? 'page' : undefined}
            className={active ? 'side-nav-link side-nav-link--active' : 'side-nav-link'}
          >
            <Icon className="side-nav-icon" aria-hidden="true" />
            {label}
          </NavLink>
        );
      })}
    </>
  );
}

/** The phone tab bar: the first four destinations by name, then Menu, which holds everything. */
export function TabBar({
  destinations,
  menuOpen,
  onMenu,
}: {
  destinations: ShellDestination[];
  menuOpen: boolean;
  onMenu(open: boolean): void;
}) {
  const current = useIsCurrent();
  const shown = destinations.slice(0, TAB_COUNT);
  const menuActive = menuOpen || !shown.some(current);
  return (
    <nav className="tab-bar" aria-label="Main">
      {shown.map((destination) => {
        const { label, path, icon: Icon } = destination;
        const active = !menuOpen && current(destination);
        return (
          <NavLink
            key={path}
            to={path}
            onClick={() => onMenu(false)}
            aria-current={active ? 'page' : undefined}
            className={active ? 'tab-bar-item tab-bar-item--active' : 'tab-bar-item'}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        );
      })}
      <button
        type="button"
        className={menuActive ? 'tab-bar-item tab-bar-item--active' : 'tab-bar-item'}
        aria-expanded={menuOpen}
        onClick={() => onMenu(!menuOpen)}
      >
        <Menu aria-hidden="true" />
        <span>Menu</span>
      </button>
    </nav>
  );
}
