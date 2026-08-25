import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSession } from '../../app/session-context';
import { OverlayDialog } from '../../components/ui/OverlayDialog';
import { Button } from '../../components/ui/Button';
import { PhotoPicker } from '../../components/ui/PhotoPicker';
import { SelectField } from '../../components/ui/SelectField';
import { TextField } from '../../components/ui/TextField';
import type { CustodyPhotoEvidence } from '../../domain/evidence';
import { useToolCategories } from '../settings/use-tool-categories';
import { useCreateWarehouseStock } from './use-create-warehouse-stock';
import { useWarehouseScopes } from './use-warehouse-scopes';

export function WarehouseStockDialog({
  defaultWarehouseId,
  onClose,
}: {
  defaultWarehouseId?: string;
  onClose(): void;
}) {
  const { session } = useSession();
  const addStock = useCreateWarehouseStock();
  const scopes = useWarehouseScopes();
  const categories = useToolCategories();
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId ?? '');
  const [serial, setSerial] = useState('');
  const [price, setPrice] = useState('');
  const [photo, setPhoto] = useState<CustodyPhotoEvidence | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  useEffect(() => {
    if (!warehouseId && scopes.data?.[0]) setWarehouseId(scopes.data[0].id);
  }, [scopes.data, warehouseId]);
  const blocked =
    !session ||
    scopes.isPending ||
    scopes.isFetching ||
    scopes.isPaused ||
    scopes.isError ||
    categories.isPending ||
    categories.isFetching ||
    categories.isPaused ||
    categories.isError;
  const category = useMemo(
    () => categories.data?.find((item) => item.id === categoryId),
    [categories.data, categoryId],
  );
  const stockCommand = () => {
    if (!session) throw new Error('An active session is required.');
    return {
      actorId: session.profileId,
      definition: {
        name,
        brand: brand || 'Unbranded',
        model: model || 'Warehouse stock',
        categoryId,
        imageKey: photo?.src ?? 'tool-photo-placeholder.svg',
      },
      warehouseId,
      destination: 'warehouse' as const,
      photoCaptured: Boolean(photo),
      serial,
      price,
      ...(photo ? { evidence: { photo } } : {}),
    };
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (blocked || photoBusy || !name.trim() || !warehouseId || !category) return;
    try {
      await addStock.mutateAsync(stockCommand());
      onClose();
    } catch {
      // The form stays mounted with its draft and the mutation error below.
    }
  };

  return (
    <OverlayDialog
      label="Add tool to inventory"
      onClose={onClose}
      panelClassName="admin-dialog operations-dialog"
      showCloseButton
    >
      <div className="dialog-heading">
        <span className="eyebrow">Warehouse inventory</span>
        <h2>Add tool</h2>
        <p>Create one individually tracked tool in warehouse inventory.</p>
      </div>
      <form className="operations-form" onSubmit={submit}>
        <TextField label="Tool name" value={name} onChange={setName} required />
        <div className="operations-form-grid">
          <TextField label="Brand" value={brand} onChange={setBrand} />
          <TextField label="Model" value={model} onChange={setModel} />
        </div>
        <SelectField
          label="Category"
          value={categoryId}
          onChange={setCategoryId}
          options={(categories.data ?? []).map((item) => ({ value: item.id, label: item.name }))}
        />
        <SelectField
          label="Warehouse"
          value={warehouseId}
          onChange={setWarehouseId}
          options={(scopes.data ?? []).map((item) => ({ value: item.id, label: item.name, description: item.address }))}
        />
        <PhotoPicker
          photo={photo}
          hint="Optional · Take or choose a photo"
          idleLabel="Add an optional tool photo"
          selectedLabel="Tool photo attached"
          preview
          onPhotoChange={setPhoto}
          onBusyChange={setPhotoBusy}
        />
        <div className="operations-form-grid">
          <TextField label="Serial number" value={serial} onChange={setSerial} />
          <TextField label="Price" value={price} onChange={setPrice} />
        </div>
        {addStock.isError && <p className="form-error">{(addStock.error as Error).message}</p>}
        <div className="dialog-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={blocked || photoBusy || addStock.isPending || !name.trim() || !warehouseId || !category}
          >
            {photoBusy ? 'Processing photo…' : addStock.isPending ? 'Adding…' : 'Add tool'}
          </Button>
        </div>
      </form>
    </OverlayDialog>
  );
}
