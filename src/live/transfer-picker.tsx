import type { Model } from './client';
import { SelectField } from './kit';
import type { TransferMode, useTransferPicker } from './tools-state';

export type TransferCandidates = { people: Model<'MemberView'>[]; warehouses: Model<'WarehouseView'>[] };
export type TransferTarget = { value: string; kind: TransferMode; name: string };

/** Resolves the picker's `person:<id>` / `warehouse:<id>` value to its destination. */
export function selectedTransferTarget(candidates: TransferCandidates, value: string): TransferTarget | null {
  const [kind, id] = value.split(':');
  if (kind === 'person') {
    const person = candidates.people.find((candidate) => candidate.id === id);
    return person ? { value, kind, name: person.preferred_name } : null;
  }
  if (kind === 'warehouse') {
    const warehouse = candidates.warehouses.find((candidate) => candidate.id === id);
    return warehouse ? { value, kind, name: warehouse.name } : null;
  }
  return null;
}

/** The demo's TransferDestinationPicker: "Send to", then a Person or Warehouse. Submits `destination`. */
export function TransferDestinationPicker({
  candidates,
  picker,
  presentation = 'sheet',
}: {
  candidates: TransferCandidates;
  picker: ReturnType<typeof useTransferPicker>;
  presentation?: 'popover' | 'sheet';
}) {
  const { people, warehouses } = candidates;
  const modeOptions = [
    { value: 'warehouse', label: 'Back to a warehouse', description: 'Returns to stock, claimable by anyone' },
    ...(people.length
      ? [{ value: 'person', label: 'To a person', description: 'Stays pending until they accept' }]
      : []),
  ];
  const destinationOptions =
    picker.mode === 'person'
      ? people.map((person) => ({
          value: `person:${person.id}`,
          label: person.preferred_name,
          ...(person.title ? { description: person.title } : {}),
        }))
      : warehouses.map((warehouse) => ({
          value: `warehouse:${warehouse.id}`,
          label: warehouse.name,
          description: 'Warehouse · returns to available stock',
        }));
  return (
    <div className="transfer-destination-picker">
      <SelectField
        label="Send to"
        value={picker.mode ?? ''}
        onChange={(value) => picker.setMode(value ? (value as TransferMode) : null)}
        options={modeOptions}
        placeholder="Choose a destination type"
        searchable={false}
        presentation={presentation}
      />
      {picker.mode ? (
        <SelectField
          label={picker.mode === 'person' ? 'Person' : 'Warehouse'}
          name="destination"
          required
          value={picker.target}
          onChange={picker.setTarget}
          options={destinationOptions}
          placeholder={picker.mode === 'person' ? 'Choose a person' : 'Choose a warehouse'}
          emptyMessage={picker.mode === 'person' ? 'No matching people' : 'No warehouses found'}
          searchable={picker.mode === 'person'}
          presentation={presentation}
        />
      ) : null}
    </div>
  );
}
