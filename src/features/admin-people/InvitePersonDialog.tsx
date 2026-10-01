import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { OverlayDialog } from '../../components/ui/OverlayDialog';
import { SelectField } from '../../components/ui/SelectField';
import { TextField } from '../../components/ui/TextField';
import { MEMBER_ROLE_LABELS, MEMBER_ROLES, type MemberRole } from '../../domain/people';
import { useAdminMutations, useAdminPeople } from '../admin/use-admin-people';
import { useAdminWarehouses } from '../admin/use-admin-warehouses';
import { isValidEmailAddress, normalizeEmailAddress } from '../../domain/email-address';
import { Link } from 'react-router-dom';

export function InvitePersonDialog({ onClose }: { onClose(): void }) {
  const warehouses = useAdminWarehouses();
  const people = useAdminPeople();
  const mutations = useAdminMutations();
  const firstWarehouse = warehouses.data?.[0]?.id ?? '';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const [role, setRole] = useState<MemberRole>('worker');
  const [homeWarehouseId, setHomeWarehouseId] = useState(firstWarehouse);
  const [submitError, setSubmitError] = useState('');
  const [invitedId, setInvitedId] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!homeWarehouseId && firstWarehouse) setHomeWarehouseId(firstWarehouse);
  }, [firstWarehouse, homeWarehouseId]);

  const busy = mutations.invite.isPending;
  const commandBlocked =
    warehouses.isPending ||
    warehouses.isFetching ||
    warehouses.isPaused ||
    warehouses.isError ||
    people.isPending ||
    people.isFetching ||
    people.isPaused ||
    people.isError ||
    !warehouses.data?.length;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const address = normalizeEmailAddress(email);
    if (!address) {
      setSubmitError('Enter an email address.');
      return;
    }
    if (!isValidEmailAddress(address)) {
      setSubmitError('Enter a valid email address.');
      return;
    }
    setSubmitError('');
    try {
      const result = await mutations.invite.mutateAsync({ name, email: address, title, role, homeWarehouseId });
      setInvitedId(result.personId ?? '');
    } catch {
      // The form stays mounted with its draft and the mutation error below.
    }
  };
  return (
    <OverlayDialog label="Invite a person" onClose={onClose} panelClassName="admin-dialog" showCloseButton>
      <div className="dialog-heading">
        <span className="eyebrow">People</span>
        <h2>Invite someone new</h2>
      </div>
      {invitedId ? (
        <div className="admin-form">
          <h3>Invitation ready for {name}</h3>
          <p className="jobs-muted">Share the invitation link so they can join Nelson Electric.</p>
          <TextField
            label="Invitation link"
            value={`${window.location.href.split('#')[0]}#/invite/${invitedId}`}
            onChange={() => undefined}
            readOnly
          />
          <Button
            onClick={() =>
              void navigator.clipboard
                .writeText(`${window.location.href.split('#')[0]}#/invite/${invitedId}`)
                .then(() => setCopied(true))
                .catch(() => setSubmitError('Select and copy the invitation link above.'))
            }
          >
            {copied ? 'Link copied' : 'Copy invitation link'}
          </Button>
          <Link className="text-button" to={`/invite/${invitedId}`} onClick={onClose}>
            View invitation
          </Link>
          {submitError && <p className="form-error">{submitError}</p>}
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      ) : (
        <form className="admin-form" onSubmit={submit} noValidate>
          <TextField label="Name" value={name} onChange={setName} required />
          <TextField
            label="Email address"
            type="email"
            value={email}
            onChange={(value) => {
              setEmail(value);
              setSubmitError('');
            }}
            placeholder="name@company.com"
            required
          />
          <TextField label="Title" value={title} onChange={setTitle} required />
          <SelectField
            label="Role"
            value={role}
            onChange={(next) => setRole(next as MemberRole)}
            options={MEMBER_ROLES.map((value) => ({ value, label: MEMBER_ROLE_LABELS[value] }))}
          />
          <SelectField
            label="Home warehouse"
            value={homeWarehouseId}
            onChange={setHomeWarehouseId}
            required
            options={(warehouses.data ?? []).map((warehouse) => ({ value: warehouse.id, label: warehouse.name }))}
          />
          {submitError ? <p className="form-error">{submitError}</p> : null}
          {!submitError && mutations.invite.isError ? (
            <p className="form-error">{(mutations.invite.error as Error).message}</p>
          ) : null}
          <div className="dialog-actions">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy || commandBlocked || !homeWarehouseId || !name.trim() || !email.trim() || !title.trim()}
            >
              {busy ? 'Creating…' : 'Create invitation'}
            </Button>
          </div>
        </form>
      )}
    </OverlayDialog>
  );
}
