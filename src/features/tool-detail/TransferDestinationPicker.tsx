import { TextField } from '../../components/ui/TextField';
import { cx } from '../../lib/cx';
import type { ToolHolderView } from '../../domain/read-models/holder';
import { holderSelectionKey } from './holder-selection-key';

export type TransferDestinationMode = 'warehouse' | 'person';

interface TransferDestinationPickerProps {
  candidates: ToolHolderView[];
  mode: TransferDestinationMode | null;
  target: string;
  personQuery: string;
  onModeChange(mode: TransferDestinationMode | null): void;
  onTargetChange(target: string): void;
  onPersonQueryChange(query: string): void;
}

export function TransferDestinationPicker({
  candidates,
  mode,
  target,
  personQuery,
  onModeChange,
  onTargetChange,
  onPersonQueryChange,
}: TransferDestinationPickerProps) {
  const people = candidates.filter((candidate) => candidate.type === 'worker');
  const warehouses = candidates.filter((candidate) => candidate.type === 'warehouse');
  const visibleCandidates = mode === 'person' ? people : mode === 'warehouse' ? warehouses : [];
  const filteredPeople = people.filter((candidate) => candidate.name.toLowerCase().includes(personQuery.toLowerCase()));
  const listCandidates = mode === 'person' ? filteredPeople : visibleCandidates;

  if (!mode) {
    return (
      <div className="transfer-destination-choices" aria-label="Choose destination type">
        <button type="button" className="transfer-destination-choice" onClick={() => onModeChange('warehouse')}>
          <span
            className="transfer-destination-choice-icon transfer-destination-choice-icon--warehouse"
            aria-hidden="true"
          >
            WH
          </span>
          <span className="transfer-destination-choice-copy">
            <strong>Back to a warehouse</strong>
            <small>Returns to stock, claimable by anyone</small>
          </span>
          <span className="transfer-destination-arrow" aria-hidden="true" />
        </button>
        <button type="button" className="transfer-destination-choice" onClick={() => onModeChange('person')}>
          <span
            className="transfer-destination-choice-icon transfer-destination-choice-icon--person"
            aria-hidden="true"
          >
            •
          </span>
          <span className="transfer-destination-choice-copy">
            <strong>To a person</strong>
            <small>Stays pending until they accept</small>
          </span>
          <span className="transfer-destination-arrow" aria-hidden="true" />
        </button>
      </div>
    );
  }

  const modeLabel = mode === 'person' ? 'Person' : 'Warehouse';
  return (
    <div className="transfer-destination-list-shell">
      <button
        type="button"
        className="transfer-destination-back"
        aria-label="Back to destination types"
        onClick={() => onModeChange(null)}
      >
        ‹&nbsp; {modeLabel}
      </button>
      {mode === 'person' ? (
        <TextField
          className="transfer-person-search"
          label="Search employees"
          value={personQuery}
          onChange={onPersonQueryChange}
          placeholder="Search employees"
          type="search"
        />
      ) : null}
      <div className="transfer-destination-options" role="listbox" aria-label={`${modeLabel} destinations`}>
        {listCandidates.length ? (
          listCandidates.map((candidate) => {
            const candidateKey = holderSelectionKey(candidate);
            const selected = candidateKey === target;
            const candidateType = candidate.type === 'warehouse' ? 'Warehouse' : 'Person';
            return (
              <button
                type="button"
                role="option"
                aria-selected={selected}
                className={cx('transfer-destination-option', selected && 'transfer-destination-option--selected')}
                key={candidateKey}
                onClick={() => onTargetChange(candidateKey)}
              >
                <span className="transfer-destination-option-icon" aria-hidden="true">
                  {candidate.type === 'warehouse' ? 'WH' : initials(candidate.name)}
                </span>
                <span className="transfer-destination-option-copy">
                  <strong>{candidate.name}</strong>
                  <small>{candidateType}</small>
                </span>
                <span className="transfer-destination-radio" aria-hidden="true" />
              </button>
            );
          })
        ) : (
          <p className="transfer-destination-empty">No one by that name.</p>
        )}
      </div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
