import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, result } from './client';
import { Button, FieldGroup, OverlayDialog, TextField } from './kit';
import { ROLES, ROLE_LABELS, type RoleCode } from './people-roles';
import { useCompany } from './session';
import { CommandForm } from './settings-command';
import { Field, Select, text } from './ui';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The demo's InvitePersonDialog, with its share-the-link success view. */
export function InvitePersonDialog({ onClose }: { onClose(): void }) {
  const c = useCompany();
  const [created, setCreated] = useState<{ name: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const link = created ? `${window.location.origin}/invite/${created.token}` : '';
  return (
    <OverlayDialog label="Invite a person" onClose={onClose} panelClassName="admin-dialog" showCloseButton>
      <div className="dialog-heading">
        <h2>Invite someone new</h2>
      </div>
      {created ? (
        <div className="admin-form">
          <h3>Invitation ready for {created.name}</h3>
          <p className="jobs-muted">We emailed the invitation. You can also share the link so they can join.</p>
          <TextField label="Invitation link" value={link} onChange={() => undefined} readOnly />
          <Button
            onClick={() =>
              void navigator.clipboard
                .writeText(link)
                .then(() => setCopied(true))
                .catch(() => setCopyError('Select and copy the invitation link above.'))
            }
          >
            {copied ? 'Link copied' : 'Copy invitation link'}
          </Button>
          <Link className="text-button" to={`/invite/${created.token}`} onClick={onClose}>
            View invitation
          </Link>
          {copyError && <p className="form-error">{copyError}</p>}
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      ) : (
        <CommandForm
          label="Create invitation"
          busyLabel="Creating…"
          onCancel={onClose}
          noValidate
          submit={async (form) => {
            const name = text(form, 'name');
            const email = text(form, 'email').toLowerCase();
            if (!name) throw new Error('Enter a name.');
            if (!email) throw new Error('Enter an email address.');
            if (!emailPattern.test(email)) throw new Error('Enter a valid email address.');
            const invitation = result(
              await api.POST('/api/companies/{company_id}/invitations', {
                params: { path: c.path },
                body: { email, preferred_name: name, role: text(form, 'role') as RoleCode },
              }),
            );
            setCreated({ name, token: invitation.token });
          }}
        >
          <FieldGroup>
            <Field label="Name" name="name" required maxLength={120} />
            <Field label="Email address" name="email" type="email" placeholder="name@company.com" required />
            <Select label="Role" name="role" defaultValue="field_member" searchable={false}>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
          </FieldGroup>
        </CommandForm>
      )}
    </OverlayDialog>
  );
}
