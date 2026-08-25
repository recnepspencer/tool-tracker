import { useCallback, useRef, useState } from 'react';
import { LogOut, Settings, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { useModalFocusTrap } from '../ui/use-modal-focus-trap';
import type { AuthSession, Role } from '../../domain/auth';
import './AccountMenu.css';

export interface AccountMenuProps {
  role: Role;
  session: AuthSession;
  onSignOut(): void;
}

export function AccountMenu({ role, session, onSignOut }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const initials = session.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2);

  useModalFocusTrap(open, close, sheetRef);

  return (
    <div className="header-account">
      <button
        type="button"
        className="account-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label="Open account menu"
      >
        <Avatar initials={initials} tone={role === 'worker' ? 'amber' : 'blue'} size="small" />
        <span className="header-name">{session.name}</span>
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
                <Avatar initials={initials} tone={role === 'worker' ? 'amber' : 'blue'} />
                <div>
                  <span className="eyebrow">Account</span>
                  <h2 id="account-sheet-heading">{session.name}</h2>
                  <p>{session.title}</p>
                </div>
              </div>
              <button type="button" className="icon-button" aria-label="Close account menu" onClick={close}>
                <X aria-hidden="true" />
              </button>
            </div>
            <dl className="account-sheet-facts">
              <div>
                <dt>Home warehouse</dt>
                <dd>{session.homeWarehouse}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{session.email}</dd>
              </div>
            </dl>
            {role === 'admin' ? (
              <Link className="account-sheet-action" aria-label="Open settings" to="/admin/settings" onClick={close}>
                <Settings aria-hidden="true" />
                <span>Settings</span>
              </Link>
            ) : null}
            <Button className="account-sheet-sign-out" variant="ghost" onClick={onSignOut}>
              <LogOut aria-hidden="true" />
              <span>Sign out</span>
            </Button>
          </section>
        </div>
      ) : null}
    </div>
  );
}
