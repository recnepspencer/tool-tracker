import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { isRemovedMember } from '../../domain/people';
import type { AdminPersonDetail } from '../../domain/read-models/admin';
import type { useAdminMutations } from '../admin/use-admin-people';

type RemoveMutation = ReturnType<typeof useAdminMutations>['remove'];

export function PersonRemovalForm({
  person,
  commandBlocked,
  mutation,
}: {
  person: AdminPersonDetail;
  commandBlocked: boolean;
  mutation: RemoveMutation;
}) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const disabled = mutation.isPending || commandBlocked;
  return (
    <div className="admin-danger-zone">
      <TextField label="Removal reason" value={reason} onChange={setReason} placeholder="Required to remove" />
      <TextField label="Removal note" hint="optional" value={note} onChange={setNote} placeholder="Optional context" />
      <Button
        variant="danger"
        disabled={disabled || !reason.trim() || isRemovedMember(person)}
        onClick={() =>
          void mutation
            .mutateAsync({ personId: person.id, reason, ...(note.trim() ? { note } : {}) })
            .catch(() => undefined)
        }
      >
        Remove person
      </Button>
      {mutation.error instanceof Error && <p className="form-error">{mutation.error.message}</p>}
    </div>
  );
}
