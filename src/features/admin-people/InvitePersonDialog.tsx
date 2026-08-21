import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { OverlayDialog } from '../../components/ui/OverlayDialog';
import { SelectField } from '../../components/ui/SelectField';
import { TextField } from '../../components/ui/TextField';
import { MEMBER_ROLE_LABELS, MEMBER_ROLES, type MemberRole } from '../../domain/people';
import { useAdminMutations, useAdminPeople } from '../admin/use-admin-people';
import { useAdminWarehouses } from '../admin/use-admin-warehouses';

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
    try {
      await mutations.invite.mutateAsync({ name, email, title, role, homeWarehouseId });
      onClose();
    } catch {
      // Keep the draft in place so the server/mock validation message is actionable.
    }
  };

  return (
    <OverlayDialog label="Invite a person" onClose={onClose} panelClassName="admin-dialog">
      <div className="dialog-heading">
        <span className="eyebrow">People</span>
        <h2>Invite someone new</h2>
      </div>
      <form className="admin-form" onSubmit={submit}>
        <TextField label="Name" value={name} onChange={setName} required />
        <TextField label="Email" type="email" value={email} onChange={setEmail} required />
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
        {mutations.invite.isError && <p className="form-error">{(mutations.invite.error as Error).message}</p>}
        <div className="dialog-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || commandBlocked || !homeWarehouseId}>
            {busy ? 'Inviting…' : 'Send invite'}
          </Button>
        </div>
      </form>
    </OverlayDialog>
  );
}
