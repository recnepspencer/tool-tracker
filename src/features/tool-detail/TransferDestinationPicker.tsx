import { SelectField } from '../../components/ui/SelectField';
import type { ToolHolderView } from '../../domain/read-models/holder';
import { holderSelectionKey } from './holder-selection-key';

export type TransferDestinationMode = 'warehouse' | 'person';

interface TransferDestinationPickerProps {
  candidates: ToolHolderView[];
  mode: TransferDestinationMode | null;
  target: string;
  onModeChange(mode: TransferDestinationMode | null): void;
  onTargetChange(target: string): void;
}

export function TransferDestinationPicker({
  candidates,
  mode,
  target,
  onModeChange,
  onTargetChange,
}: TransferDestinationPickerProps) {
  const people = candidates.filter((candidate) => candidate.type === 'worker');
  const warehouses = candidates.filter((candidate) => candidate.type === 'warehouse');
  const destinationOptions = (mode === 'person' ? people : warehouses).map((candidate) => ({
    value: holderSelectionKey(candidate),
    label: candidate.name,
    description: candidate.type === 'warehouse' ? 'Warehouse' : 'Person',
  }));
  const modeValue = mode ?? '';
  const modeOptions = [
    {
      value: 'warehouse',
      label: 'Back to a warehouse',
      description: 'Returns to stock, claimable by anyone',
    },
    {
      value: 'person',
      label: 'To a person',
      description: 'Stays pending until they accept',
    },
  ];

  return (
    <div className="transfer-destination-picker">
      <SelectField
        label="Send to"
        value={modeValue}
        onChange={(value) => onModeChange(value ? (value as TransferDestinationMode) : null)}
        options={modeOptions}
        placeholder="Choose a destination type"
        searchable={false}
        presentation="sheet"
      />
      {mode ? (
        <SelectField
          label={mode === 'person' ? 'Person' : 'Warehouse'}
          value={target}
          onChange={onTargetChange}
          options={destinationOptions}
          placeholder={mode === 'person' ? 'Choose a person' : 'Choose a warehouse'}
          emptyMessage={mode === 'person' ? 'No people found' : 'No warehouses found'}
          searchable={false}
          presentation="sheet"
        />
      ) : null}
    </div>
  );
}
