import { useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronRight, KeyRound, LogOut, RefreshCw, Settings } from 'lucide-react';
import { Avatar, SelectField } from './kit';
import { initials } from './format';
import { useModalFocusTrap } from './experience/use-modal-focus-trap';
import { ThemeToggle, useIsCurrent } from './shell-chrome';
import type { ShellDestination, useShellAccount } from './shell-state';

type Account = ReturnType<typeof useShellAccount>;

/** Pages that set the company up rather than run its day; the menu lists them under "Setup". */
const setupPaths = ['/app/warehouses', '/app/catalog', '/app/activity', '/app/settings'];

/**
 * The tab bar's Menu: every page by name, the account and its commands, in one full screen above
 * the tab bar. It replaces a hidden "More" list and a separate account sheet, so nothing is unlabelled.
 */
export function MenuScreen({
  account,
  destinations,
  control,
  settings,
  theme,
  onToggleTheme,
  onClose,
}: {
  account: Account;
  destinations: ShellDestination[];
  control: boolean;
  settings: boolean;
  theme: 'dark' | 'light';
  onToggleTheme(): void;
  onClose(): void;
}) {
  const menuRef = useRef<HTMLElement>(null);
  useModalFocusTrap(true, onClose, menuRef);
  const current = useIsCurrent();
  const pages = settings
    ? [...destinations, { label: 'Settings', path: '/app/settings', icon: Settings }]
    : destinations;
  const groups = control
    ? [
        { label: 'Work', items: pages.filter((page) => !setupPaths.includes(page.path)) },
        { label: 'Setup', items: pages.filter((page) => setupPaths.includes(page.path)) },
      ]
    : [{ label: 'Pages', items: pages }];
  const subtitle = [account.companyName, account.title].filter(Boolean).join(' · ');
  return (
    <div className="app-menu-layer" role="presentation">
      <section ref={menuRef} className="app-menu" role="dialog" aria-modal="true" aria-labelledby="app-menu-title">
        <header className="app-menu-header">
          <h2 id="app-menu-title">Menu</h2>
          <button type="button" className="button button--ghost" onClick={onClose}>
            Done
          </button>
        </header>
        <div className="app-menu-account">
          <Avatar initials={initials(account.name)} tone="blue" />
          <div>
            <strong>{account.name}</strong>
            <span>{subtitle}</span>
            <span>{account.email}</span>
          </div>
        </div>
        {account.workspaces.length > 1 && (
          <div className="app-menu-workspace">
            <SelectField
              label="Workspace"
              searchable={false}
              presentation="sheet"
              value={account.companyId}
              onChange={account.chooseWorkspace}
              options={account.workspaces}
            />
          </div>
        )}
        <nav className="app-menu-pages" aria-label="Pages">
          {groups
            .filter((group) => group.items.length)
            .map((group) => (
              <section key={group.label} className="app-menu-group" aria-labelledby={`app-menu-${group.label}`}>
                <h3 id={`app-menu-${group.label}`} className="app-menu-label">
                  {group.label}
                </h3>
                <ul className="app-menu-rows">
                  {group.items.map((page) => {
                    const { label, path, icon: Icon } = page;
                    const active = current(page);
                    return (
                      <li key={path}>
                        <NavLink
                          to={path}
                          onClick={onClose}
                          aria-current={active ? 'page' : undefined}
                          className={active ? 'app-menu-row app-menu-row--active' : 'app-menu-row'}
                        >
                          <Icon className="app-menu-icon" aria-hidden="true" />
                          <span>{label}</span>
                          <ChevronRight className="app-menu-chevron" aria-hidden="true" />
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
        </nav>
        <section className="app-menu-group" aria-labelledby="app-menu-account-label">
          <h3 id="app-menu-account-label" className="app-menu-label">
            Account
          </h3>
          <ul className="app-menu-rows">
            <li className="app-menu-switch">
              <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} />
            </li>
            <li>
              <NavLink className="app-menu-row" to="/forgot-password" onClick={onClose}>
                <KeyRound className="app-menu-icon" aria-hidden="true" />
                <span>Change password</span>
                <ChevronRight className="app-menu-chevron" aria-hidden="true" />
              </NavLink>
            </li>
            <li>
              <button
                type="button"
                className="app-menu-row"
                disabled={account.refreshing}
                aria-busy={account.refreshing}
                onClick={() => void account.refreshAccess()}
              >
                <RefreshCw className="app-menu-icon" aria-hidden="true" />
                <span>Refresh access</span>
              </button>
            </li>
          </ul>
          {account.refreshError && (
            <p className="form-error" role="alert">
              {account.refreshError}
            </p>
          )}
        </section>
        <ul className="app-menu-rows">
          <li>
            <button type="button" className="app-menu-row app-menu-row--danger" onClick={account.signOut}>
              <LogOut className="app-menu-icon" aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </li>
        </ul>
      </section>
    </div>
  );
}
