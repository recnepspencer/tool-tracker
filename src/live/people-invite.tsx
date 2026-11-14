import { useState } from 'react';
import { api, result } from './client';
import { Button, FieldGroup, OverlayDialog } from './kit';
import { ROLES, ROLE_LABELS, type RoleCode } from './people-roles';
import { useCompany } from './session';
import { CommandForm } from './settings-command';
import { Field, Select, text } from './ui';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Invitations are delivered to the named recipient by email. */
export function InvitePersonDialog({ onClose }: { onClose(): void }) {
  const c = useCompany();
  const [created, setCreated] = useState<{ name: string } | null>(null);
  return (
    <OverlayDialog label="Invite a person" onClose={onClose} panelClassName="admin-dialog" showCloseButton>
      <div className="dialog-heading">
        <h2>Invite someone new</h2>
      </div>
      {created ? (
        <div className="admin-form">
          <h3>Invitation ready for {created.name}</h3>
          <p className="jobs-muted">We emailed the invitation.</p>
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
            result(
              await api.POST('/api/companies/{company_id}/invitations', {
                params: { path: c.path },
                body: { email, preferred_name: name, role: text(form, 'role') as RoleCode },
              }),
            );
            setCreated({ name });
          }}
        >
          <FieldGroup>
            <Field label="Name" name="name" required maxLength={120} />
            <Field label="Email address" name="email" type="email" placeholder="name@company.com" required />
            <Select label="Role" name="role" defaultValue="foreman" searchable={false}>
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
