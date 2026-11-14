import { Info } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { OverlayDialog } from './kit';
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS } from './people-roles';

/** The three roles in one short sheet, behind an info button beside the title. */
export function RoleGuideButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="page-heading-info"
        aria-label="What each role can do"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Info aria-hidden="true" />
      </button>
      {open && (
        <OverlayDialog label="Roles" onClose={() => setOpen(false)} panelClassName="admin-dialog" showCloseButton>
          <div className="dialog-heading">
            <h2>Roles</h2>
          </div>
          <ul className="role-guide">
            {[...ROLES].reverse().map((role) => (
              <li key={role}>
                <strong>{ROLE_LABELS[role]}</strong>
                <span>{ROLE_DESCRIPTIONS[role]}</span>
              </li>
            ))}
          </ul>
          <Link className="text-button" to="/app/access" onClick={() => setOpen(false)}>
            See every permission
          </Link>
        </OverlayDialog>
      )}
    </>
  );
}
