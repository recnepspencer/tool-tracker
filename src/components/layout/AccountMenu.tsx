import { useCallback, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
  const location = useLocation();
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
              <div>
                <span className="eyebrow">Account</span>
                <h2 id="account-sheet-heading">{session.name}</h2>
              </div>
              <button type="button" className="icon-button" aria-label="Close account menu" onClick={close}>
                ×
              </button>
            </div>
            <p>
              {session.title} · {session.homeWarehouse}
            </p>
            <p>{session.email}</p>
            {role === 'admin' && location.pathname !== '/admin/settings' ? (
              <Link className="account-sheet-link" aria-label="Open settings" to="/admin/settings" onClick={close}>
                Open settings
              </Link>
            ) : null}
            <Button variant="ghost" onClick={onSignOut}>
              Sign out
            </Button>
          </section>
        </div>
      ) : null}
    </div>
  );
}
