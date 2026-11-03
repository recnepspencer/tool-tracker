import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, LogOut, RefreshCw, Settings, X } from 'lucide-react';
import { Avatar, Button, SelectField } from './kit';
import { initials } from './format';
import { useModalFocusTrap } from './experience/use-modal-focus-trap';
import type { useShellAccount } from './shell-state';

type Account = ReturnType<typeof useShellAccount>;

/** Demo AccountMenu: the header trigger and the control-room account sheet. */
export function AccountMenu({
  account,
  open,
  settings,
  onOpenChange,
}: {
  account: Account;
  open: boolean;
  settings: boolean;
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
                  <span className="eyebrow">Account</span>
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
            {settings ? (
              <Link className="account-sheet-action" aria-label="Open settings" to="/app/settings" onClick={close}>
                <Settings aria-hidden="true" />
                <span>Settings</span>
              </Link>
            ) : null}
            <Link className="account-sheet-action" to="/forgot-password" onClick={close}>
              <KeyRound aria-hidden="true" />
              <span>Change password</span>
            </Link>
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

/** Demo WorkerAccountSheet: the bottom account sheet opened from the drawer profile. */
export function AccountSheet({
  account,
  open,
  settings,
  onClose,
}: {
  account: Account;
  open: boolean;
  settings: boolean;
  onClose(): void;
}) {
  const sheetRef = useRef<HTMLElement>(null);
  useModalFocusTrap(open, onClose, sheetRef);
  if (!open) return null;
  return (
    <div className="worker-account-layer" role="presentation">
      <button
        type="button"
        className="worker-scrim worker-scrim--strong"
        aria-label="Close account menu"
        onClick={onClose}
      />
      <section
        ref={sheetRef}
        className="worker-bottom-sheet worker-account-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={account.name}
      >
        <span className="worker-sheet-handle" />
        <div className="worker-account-sheet-topbar">
          <button type="button" className="worker-close-button" aria-label="Close account menu" onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="worker-account-heading">
          <span className="worker-avatar worker-avatar--large">{initials(account.name)}</span>
          <div>
            <span className="worker-form-label">Account</span>
            <h2>{account.name}</h2>
            {account.title && <p>{account.title}</p>}
          </div>
        </div>
        <div className="worker-account-facts">
          {account.workspaces.length < 2 && (
            <div>
              <span>Workspace</span>
              <strong>{account.companyName}</strong>
            </div>
          )}
          <div>
            <span>Email</span>
            <strong>{account.email}</strong>
          </div>
        </div>
        {account.workspaces.length > 1 && (
          <SelectField
            label="Workspace"
            searchable={false}
            presentation="sheet"
            value={account.companyId}
            onChange={account.chooseWorkspace}
            options={account.workspaces}
          />
        )}
        {settings ? (
          <Link
            className="worker-sheet-secondary-button worker-account-settings-link"
            to="/app/settings"
            onClick={onClose}
          >
            <Settings aria-hidden="true" />
            <span>Settings</span>
          </Link>
        ) : null}
        <Link className="worker-sheet-secondary-button worker-account-settings-link" to="/forgot-password">
          <KeyRound aria-hidden="true" />
          <span>Change password</span>
        </Link>
        <button
          type="button"
          className="worker-sheet-secondary-button"
          disabled={account.refreshing}
          aria-busy={account.refreshing}
          onClick={() => void account.refreshAccess()}
        >
          Refresh access
        </button>
        {account.refreshError && (
          <p className="form-error" role="alert">
            {account.refreshError}
          </p>
        )}
        <button type="button" className="worker-sheet-secondary-button" onClick={account.signOut}>
          Sign out
        </button>
      </section>
    </div>
  );
}
