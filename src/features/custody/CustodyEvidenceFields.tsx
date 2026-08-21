import { Switch } from '../../components/ui/Switch';
import { TextAreaField } from '../../components/ui/TextField';

export interface CustodyEvidenceDraft {
  note: string;
  mockPhoto: boolean;
}

interface CustodyEvidenceFieldsProps extends CustodyEvidenceDraft {
  onNoteChange(note: string): void;
  onMockPhotoChange(mockPhoto: boolean): void;
  className?: string;
}

export function CustodyEvidenceFields({
  note,
  mockPhoto,
  onNoteChange,
  onMockPhotoChange,
  className = '',
}: CustodyEvidenceFieldsProps) {
  return (
    <div className={`custody-evidence-fields ${className}`.trim()}>
      <TextAreaField
        label="Note"
        hint="optional"
        value={note}
        onChange={onNoteChange}
        placeholder="Add context for the record"
      />
      <Switch label="Add a photo to this record" checked={mockPhoto} onCheckedChange={onMockPhotoChange} />
    </div>
  );
}
