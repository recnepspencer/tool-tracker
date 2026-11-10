import type { Model } from './client';
import { FieldGroup, OverlayDialog, SelectField, ToolPhoto, cx } from './kit';
import { CustodyEvidenceFields } from './photos';
import {
  caseKindLabels,
  caseProblem,
  recordIdentity,
  useCaseResolution,
  type CaseOutcome,
  type CaseRecord,
} from './reconciliation-state';
import { useCompany } from './session';
import { CommandForm } from './tool-detail-form';
import { formatDate } from './format';
import { photoSrc } from './tool-status';
import './reconciliation.css';

type Case = Model<'ReconciliationView'>;

/** A choice of two or three, drawn as the kit's segmented control. */
function OutcomeChoice({
  options,
  value,
  onChange,
}: {
  options: { value: CaseOutcome; label: string }[];
  value: CaseOutcome;
  onChange(value: CaseOutcome): void;
}) {
  return (
    <div className="segmented reconciliation-outcomes" role="radiogroup" aria-label="Outcome">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** The two records of a duplicate side by side; the person picks the one to keep. */
function RecordComparison({
  records,
  keep,
  onKeep,
}: {
  records: [CaseRecord, CaseRecord];
  keep: string;
  onKeep(id: string): void;
}) {
  const c = useCompany();
  return (
    <div className="reconciliation-compare" role="radiogroup" aria-label="Record to keep">
      {records.map((record) => {
        const kept = record.id === keep;
        return (
          <button
            key={record.id}
            type="button"
            role="radio"
            aria-checked={kept}
            aria-label={`Keep ${record.name}, ${recordIdentity(record)}`}
            className={cx('reconciliation-record', kept && 'reconciliation-record--kept')}
            onClick={() => onKeep(record.id)}
          >
            <ToolPhoto src={photoSrc(c.company_id, record.registration_photo_id)} alt="" size="card" />
            <span className="reconciliation-record__verdict">{kept ? 'Keep' : 'Retire'}</span>
            <strong>{record.name}</strong>
            <dl>
              <div>
                <dt>Serial</dt>
                <dd>{record.serial_number ?? 'None'}</dd>
              </div>
              <div>
                <dt>Holder</dt>
                <dd>{record.holder_name ?? 'No one'}</dd>
              </div>
              <div>
                <dt>Registered</dt>
                <dd>{formatDate(record.registered_at)}</dd>
              </div>
            </dl>
          </button>
        );
      })}
    </div>
  );
}

/** Settle one reconciliation case: pick what happened, then fill in only what that needs. */
export function ResolveCaseDialog({
  item,
  asset,
  people,
  warehouses,
  onClose,
}: {
  item: Case;
  asset?: Model<'AssetView'>;
  people: Model<'MemberView'>[];
  warehouses: Model<'WarehouseView'>[];
  onClose(): void;
}) {
  const {
    options,
    outcome,
    setOutcome,
    chosen,
    other,
    keep,
    setKeep,
    destination,
    setDestination,
    moves,
    destinations,
    photo,
    resolve,
  } = useCaseResolution(item, asset, people, warehouses);
  return (
    <OverlayDialog
      label={`Resolve ${item.record.name}`}
      onClose={onClose}
      panelClassName="admin-dialog operations-dialog"
      showCloseButton
    >
      <div className="dialog-heading">
        <h2>
          {caseKindLabels[item.kind]}: {item.record.name}
        </h2>
        <p>{caseProblem(item)}</p>
        {item.narrative && <p className="reconciliation-narrative">“{item.narrative}”</p>}
      </div>
      <CommandForm
        label="Resolve case"
        submitLabel={chosen.submit}
        submitVariant={outcome === 'write_off' ? 'danger' : 'primary'}
        disabled={moves && !destination}
        onCancel={onClose}
        onDone={() => {
          photo.clear();
          onClose();
        }}
        submit={resolve}
      >
        <div className="operations-form reconciliation-form">
          {options.length > 1 ? (
            <div className="reconciliation-choice">
              <OutcomeChoice options={options} value={outcome} onChange={setOutcome} />
              <p className="reconciliation-choice__hint">{chosen.description}</p>
            </div>
          ) : (
            <p className="reconciliation-choice__hint">{chosen.description}</p>
          )}
          {outcome === 'merge' && other && (
            <RecordComparison records={[item.record, other]} keep={keep} onKeep={setKeep} />
          )}
          {outcome === 'merge' && (
            <p className="reconciliation-choice__hint">
              A serial number or photo the kept record lacks is copied over from the retired one.
            </p>
          )}
          {moves && (
            <FieldGroup>
              <SelectField
                label={outcome === 'found' ? 'Where is it now?' : 'Who has it now?'}
                name="destination"
                value={destination}
                onChange={setDestination}
                options={destinations}
                placeholder="Choose a person or warehouse"
                emptyMessage="No matching people or warehouses"
                searchable
                required
              />
            </FieldGroup>
          )}
          {outcome === 'write_off' && (
            <p className="reconciliation-warning" role="note">
              This can’t be undone. {item.record.name} is marked disposed and leaves inventory, and open requests for it
              are declined.
            </p>
          )}
          <CustodyEvidenceFields
            context="review"
            noteName="note"
            noteLabel="Note"
            notePlaceholder="What you found"
            showPhoto={outcome !== 'not_duplicate' && outcome !== 'records_correct'}
          />
        </div>
      </CommandForm>
    </OverlayDialog>
  );
}
