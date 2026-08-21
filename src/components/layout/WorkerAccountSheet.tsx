import { useRef } from 'react';
import { useModalFocusTrap } from '../ui/use-modal-focus-trap';
import { Switch } from '../ui/Switch';
import type { AuthSession } from '../../domain/auth';

interface WorkerAccountSheetProps {
  open: boolean;
  session: AuthSession;
  theme: 'dark' | 'light';
  onToggleTheme(): void;
  onSignOut(): void;
  onClose(): void;
}

export function WorkerAccountSheet({
  open,
  session,
  theme,
  onToggleTheme,
  onSignOut,
  onClose,
}: WorkerAccountSheetProps) {
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
        aria-label={session.name}
      >
        <span className="worker-sheet-handle" />
        <div className="worker-account-heading">
          <span className="worker-avatar worker-avatar--large">{initials(session.name)}</span>
          <div>
            <span className="worker-form-label">Account</span>
            <h2>{session.name}</h2>
            <p>{session.title}</p>
          </div>
          <button type="button" className="worker-close-button" aria-label="Close account menu" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="worker-account-facts">
          <div>
            <span>Home warehouse</span>
            <strong>{session.homeWarehouse}</strong>
          </div>
          <div>
            <span>Email</span>
            <strong>{session.email}</strong>
          </div>
        </div>
        <Switch
          label="Light mode"
          description={theme === 'dark' ? 'Use a light field surface.' : 'Use the dark field surface.'}
          checked={theme === 'light'}
          onCheckedChange={onToggleTheme}
        />
        <button type="button" className="worker-sheet-secondary-button" onClick={onSignOut}>
          Sign out
        </button>
      </section>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
