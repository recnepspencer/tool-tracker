import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, RefreshCw, Settings, X } from 'lucide-react';
import { AccountPassword } from './account-password';
import { Avatar, Button, SelectField } from './kit';
import { initials } from './format';
import { useModalFocusTrap } from './experience/use-modal-focus-trap';
import { ThemeToggle } from './shell-chrome';
import type { useShellAccount } from './shell-state';

type Account = ReturnType<typeof useShellAccount>;

/** The desktop header's account trigger and its sheet; phones reach the same things from Menu. */
export function AccountMenu({
  account,
  open,
  settings,
  theme,
  onToggleTheme,
  onOpenChange,
}: {
  account: Account;
  open: boolean;
  settings: boolean;
  theme: 'dark' | 'light';
  onToggleTheme(): void;
  onOpenChange(open: boolean): void;
}) {
  const sheetRef = useRef<HTMLElement>(null);
  const close = () => onOpenChange(false);
  useModalFocusTrap(open, close, sheetRef);
  const avatar = initials(account.name);
  return (
    <div className="header-account">
      <button
        type="button"
        className="account-trigger"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-label="Open account menu"
      >
        <Avatar initials={avatar} tone="blue" size="small" />
        <span className="header-name">{account.name}</span>
      </button>
      {open ? (
        <div
          className="account-sheet-backdrop"
          role="presentation"
          onMouseDown={(event) => event.target === event.currentTarget && close()}
        >
          <section
            ref={sheetRef}
            className="account-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-sheet-heading"
          >
            <div className="account-sheet-header">
              <div className="account-sheet-identity">
                <Avatar initials={avatar} tone="blue" />
                <div>
                  <h2 id="account-sheet-heading">{account.name}</h2>
                  {account.title && <p>{account.title}</p>}
                </div>
              </div>
              <button type="button" className="icon-button" aria-label="Close account menu" onClick={close}>
                <X aria-hidden="true" />
              </button>
            </div>
            <dl className="account-sheet-facts">
              {account.workspaces.length < 2 && (
                <div>
                  <dt>Workspace</dt>
                  <dd>{account.companyName}</dd>
                </div>
              )}
              <div>
                <dt>Email</dt>
                <dd>{account.email}</dd>
              </div>
            </dl>
            {account.workspaces.length > 1 && (
              <SelectField
                label="Workspace"
                searchable={false}
                value={account.companyId}
                onChange={account.chooseWorkspace}
                options={account.workspaces}
              />
            )}
            <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} />
            {settings ? (
              <Link className="account-sheet-action" aria-label="Open settings" to="/app/settings" onClick={close}>
                <Settings aria-hidden="true" />
                <span>Settings</span>
              </Link>
            ) : null}
            <AccountPassword className="account-sheet-action" />
            <Button
              className="account-sheet-sign-out"
              variant="ghost"
              disabled={account.refreshing}
              aria-busy={account.refreshing}
              onClick={() => void account.refreshAccess()}
            >
              <RefreshCw aria-hidden="true" />
              <span>Refresh access</span>
            </Button>
            {account.refreshError && (
              <p className="form-error" role="alert">
                {account.refreshError}
              </p>
            )}
            <Button className="account-sheet-sign-out" variant="ghost" onClick={account.signOut}>
              <LogOut aria-hidden="true" />
              <span>Sign out</span>
            </Button>
          </section>
        </div>
      ) : null}
    </div>
  );
}
