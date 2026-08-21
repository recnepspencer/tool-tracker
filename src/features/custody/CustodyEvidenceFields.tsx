import { TextField } from '../../components/ui/TextField';

export interface CustodyEvidenceDraft {
  note: string;
  mockPhoto: boolean;
}

interface CustodyEvidenceFieldsProps extends CustodyEvidenceDraft {
  onNoteChange(note: string): void;
  onMockPhotoChange(mockPhoto: boolean): void;
  className?: string;
  context?: 'transfer' | 'review' | 'request';
  notePlaceholder?: string;
}

export function CustodyEvidenceFields({
  note,
  mockPhoto,
  onNoteChange,
  onMockPhotoChange,
  className = '',
  context = 'request',
  notePlaceholder,
}: CustodyEvidenceFieldsProps) {
  const resolvedNotePlaceholder =
    notePlaceholder ??
    (context === 'transfer'
      ? 'e.g. battery is in the case'
      : context === 'review'
        ? 'e.g. left it on the bench'
        : 'Add context for the record');
  const photoHint = context === 'review' ? 'Condition, damage, where you left it' : 'Show its condition at handoff';
  return (
    <div className={`custody-evidence-fields ${className}`.trim()}>
      <TextField
        label="Note"
        hint="optional"
        value={note}
        onChange={onNoteChange}
        placeholder={resolvedNotePlaceholder}
      />
      <button
        type="button"
        role="switch"
        className={`custody-photo-toggle${mockPhoto ? ' custody-photo-toggle--selected' : ''}`}
        aria-checked={mockPhoto}
        aria-label="Add a photo to this record"
        onClick={() => onMockPhotoChange(!mockPhoto)}
      >
        <span className="custody-photo-preview" aria-hidden="true">
          <span>{mockPhoto ? '✓' : '+'}</span>
        </span>
        <span className="custody-photo-copy">
          <strong>{mockPhoto ? 'Photo attached' : 'Add a photo'}</strong>
          <small>{mockPhoto ? 'Tap to remove' : photoHint}</small>
        </span>
      </button>
    </div>
  );
}
