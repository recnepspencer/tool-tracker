import { Users, Warehouse } from 'lucide-react';
import { Field } from './ui';
import { useTransferPicker } from './tools-state';

export type TransferTarget = { value: string; kind: 'person' | 'warehouse'; name: string; detail: string };
export function TransferPicker({
  targets,
  picker,
}: {
  targets: TransferTarget[];
  picker: ReturnType<typeof useTransferPicker>;
}) {
  const selected = targets.find((target) => target.value === picker.selected);
  return (
    <div className="transfer-picker">
      <input type="hidden" name="destination" value={selected?.value ?? ''} />
      {selected ? (
        <div className="transfer-selected">
          <div>
            <strong>{selected.name}</strong>
            <p className="muted">{selected.detail}</p>
          </div>
          <button type="button" onClick={picker.change}>
            Change destination
          </button>
        </div>
      ) : (
        <>
          <div className="transfer-modes" role="group" aria-label="Destination type">
            <button type="button" aria-pressed={picker.mode === 'person'} onClick={() => picker.setMode('person')}>
              <Users size={20} />
              Person
            </button>
            <button
              type="button"
              aria-pressed={picker.mode === 'warehouse'}
              onClick={() => picker.setMode('warehouse')}
            >
              <Warehouse size={20} />
              Warehouse
            </button>
          </div>
          <Field
            label="Search destinations"
            type="search"
            value={picker.search}
            onChange={(event) => picker.setSearch(event.target.value)}
          />
          <div className="transfer-options" role="radiogroup" aria-label="Send to">
            {targets
              .filter(
                (target) =>
                  target.kind === picker.mode &&
                  `${target.name} ${target.detail}`.toLowerCase().includes(picker.search.toLowerCase()),
              )
              .map((target) => (
                <label className="transfer-option" key={target.value}>
                  <input
                    type="radio"
                    name="target-choice"
                    aria-label={target.name}
                    value={target.value}
                    checked={picker.selected === target.value}
                    onChange={() => picker.select(target.value)}
                  />
                  <div>
                    <strong>{target.name}</strong>
                    <small>{target.detail}</small>
                  </div>
                </label>
              ))}
            {!targets.some(
              (target) =>
                target.kind === picker.mode &&
                `${target.name} ${target.detail}`.toLowerCase().includes(picker.search.toLowerCase()),
            ) && <p className="muted">No eligible destinations match.</p>}
          </div>
        </>
      )}
    </div>
  );
}
