import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { AccountForm, PasswordFields, PasswordInput } from './auth-ui';
import { api } from './client';
import { Button } from './kit';

/** Password changes stay inside the account surface that opened them. */
export function AccountPassword({ className }: { className?: string }) {
  const [editing, setEditing] = useState(false);
  const [changed, setChanged] = useState(false);
  return (
    <div>
      {changed && <p role="status">Your password has been changed.</p>}
      {editing ? (
        <AccountForm
          label="Save password"
          pendingLabel="Changing password…"
          submit={async (form) => {
            if (form.get('password') !== form.get('confirm')) throw new Error('Passwords do not match.');
            await api.POST('/api/auth/change-password', {
              body: { current_password: String(form.get('current_password')), password: String(form.get('password')) },
            });
            setEditing(false);
            setChanged(true);
          }}
        >
          <PasswordInput label="Current password" name="current_password" />
          <PasswordFields />
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </AccountForm>
      ) : (
        <button
          type="button"
          className={className}
          onClick={() => {
            setChanged(false);
            setEditing(true);
          }}
        >
          <KeyRound aria-hidden="true" />
          <span>Change password</span>
        </button>
      )}
    </div>
  );
}
