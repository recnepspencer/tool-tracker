import { useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { OverlayDialog } from '../../components/ui/OverlayDialog';
import { SelectField } from '../../components/ui/SelectField';
import { TextField } from '../../components/ui/TextField';
import { isEligibleWarehouseManager } from '../../domain/warehouse';
import { useAdminPeople } from '../admin/use-admin-people';
import { useAdminWarehouseMutations, useAdminWarehouses } from '../admin/use-admin-warehouses';

export interface EditableWarehouse {
  id: string;
  name: string;
  address: string;
  managerId: string;
}

export function WarehouseDialog({ warehouse, onClose }: { warehouse?: EditableWarehouse; onClose(): void }) {
  const people = useAdminPeople();
  const warehouses = useAdminWarehouses();
  const mutations = useAdminWarehouseMutations();
  const [name, setName] = useState(warehouse?.name ?? '');
  const [address, setAddress] = useState(warehouse?.address ?? '');
  const [managerId, setManagerId] = useState(warehouse?.managerId ?? '');
  const managers = (people.data ?? []).filter(isEligibleWarehouseManager);
  const selectedManager = managers.find((manager) => manager.id === managerId);
  const busy = mutations.create.isPending || mutations.update.isPending;
  const commandBlocked =
    people.isPending ||
    people.isFetching ||
    people.isPaused ||
    people.isError ||
    warehouses.isPending ||
    warehouses.isFetching ||
    warehouses.isPaused ||
    warehouses.isError ||
    !selectedManager;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      if (warehouse) await mutations.update.mutateAsync({ warehouseId: warehouse.id, name, address, managerId });
      else await mutations.create.mutateAsync({ name, address, managerId });
      onClose();
    } catch {
      // Keep form values visible alongside the adapter validation error.
    }
  };
  const error = mutations.create.error ?? mutations.update.error;
  return (
    <OverlayDialog
      label={warehouse ? 'Edit warehouse' : 'Create warehouse'}
      onClose={onClose}
      panelClassName="admin-dialog"
    >
      <div className="dialog-heading">
        <span className="eyebrow">Warehouses</span>
        <h2>{warehouse ? 'Edit warehouse' : 'Add a warehouse'}</h2>
      </div>
      <form className="admin-form" onSubmit={submit}>
        <TextField label="Name" value={name} onChange={setName} required />
        <TextField label="Address" value={address} onChange={setAddress} required />
        <SelectField
          label="Manager"
          value={managerId}
          onChange={setManagerId}
          required
          placeholder="Choose a manager"
          options={managers.map((person) => ({ value: person.id, label: person.name, description: person.title }))}
        />
        {error && <p className="form-error">{(error as Error).message}</p>}
        <div className="dialog-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || commandBlocked || !managerId}>
            {busy ? 'Saving…' : 'Save warehouse'}
          </Button>
        </div>
      </form>
    </OverlayDialog>
  );
}
