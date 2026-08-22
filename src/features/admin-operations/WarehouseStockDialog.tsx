import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSession } from '../../app/session-context';
import { OverlayDialog } from '../../components/ui/OverlayDialog';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/SelectField';
import { TextField } from '../../components/ui/TextField';
import { useToolCategories } from '../settings/use-tool-categories';
import { useCreateWarehouseStock } from './use-create-warehouse-stock';
import { useWarehouseScopes } from './use-warehouse-scopes';

const minimumQuantity = 1;
const maximumQuantity = 20;

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
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');

  useEffect(() => {
    if (!warehouseId && scopes.data?.[0]) setWarehouseId(scopes.data[0].id);
  }, [scopes.data, warehouseId]);
  const parsedQuantity = Number.parseInt(quantity, 10);
  const validQuantity =
    Number.isInteger(parsedQuantity) && parsedQuantity >= minimumQuantity && parsedQuantity <= maximumQuantity;
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
  const stockCommands = () => {
    if (!session || !validQuantity) throw new Error(`Quantity must be ${minimumQuantity}–${maximumQuantity}.`);
    return Array.from({ length: parsedQuantity }, () => ({
      actorId: session.profileId,
      definition: {
        name,
        brand: brand || 'Unbranded',
        model: model || 'Warehouse stock',
        categoryId,
        imageKey: 'tool-photo-placeholder.svg',
      },
      warehouseId,
      destination: 'warehouse' as const,
      photoCaptured: false,
      price,
    }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (blocked || !name.trim() || !warehouseId || !category || !validQuantity) return;
    try {
      await addStock.mutateAsync(stockCommands());
      onClose();
    } catch {
      // The form stays mounted with its draft and the mutation error below.
    }
  };

  return (
    <OverlayDialog
      label="Add tools to inventory"
      onClose={onClose}
      panelClassName="admin-dialog operations-dialog"
      showCloseButton
    >
      <div className="dialog-heading">
        <span className="eyebrow">Warehouse inventory</span>
        <h2>Add tools</h2>
        <p>Add one tool or a matching batch directly to warehouse stock.</p>
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
        <div className="operations-form-grid">
          <TextField label="Quantity" type="number" value={quantity} onChange={setQuantity} required />
          <TextField label="Price per tool" value={price} onChange={setPrice} />
        </div>
        {!validQuantity && (
          <p className="form-error">
            Quantity must be {minimumQuantity}–{maximumQuantity}.
          </p>
        )}
        {addStock.isError && <p className="form-error">{(addStock.error as Error).message}</p>}
        <div className="dialog-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={blocked || addStock.isPending || !name.trim() || !warehouseId || !category || !validQuantity}
          >
            {addStock.isPending ? 'Adding…' : parsedQuantity === 1 ? 'Add tool' : `Add ${parsedQuantity} tools`}
          </Button>
        </div>
      </form>
    </OverlayDialog>
  );
}
