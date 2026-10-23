import { Button } from '../../components/ui/Button';
import { canChangePersonAccess } from '../../domain/people';
import type { AdminPersonDetail } from '../../domain/read-models/admin';
import type { useAdminMutations } from '../admin/use-admin-people';

type AccessMutation = ReturnType<typeof useAdminMutations>['setAccess'];

export function PersonAccessActions({
  person,
  commandBlocked,
  mutation,
}: {
  person: AdminPersonDetail;
  commandBlocked: boolean;
  mutation: AccessMutation;
}) {
  const disabled = mutation.isPending || commandBlocked;
  return (
    <div className="admin-danger-zone">
      <span className="eyebrow">Access actions</span>
      <div className="dialog-actions">
        <Button
          variant="secondary"
          disabled={disabled || !canChangePersonAccess(person.lifecycle, 'active')}
          onClick={() => void mutation.mutateAsync({ personId: person.id, access: 'active' }).catch(() => undefined)}
        >
          Restore access
        </Button>
        <Button
          variant="secondary"
          disabled={disabled || !canChangePersonAccess(person.lifecycle, 'suspended')}
          onClick={() => void mutation.mutateAsync({ personId: person.id, access: 'suspended' }).catch(() => undefined)}
        >
          Suspend
        </Button>
      </div>
      {mutation.error instanceof Error && <p className="form-error">{mutation.error.message}</p>}
    </div>
  );
}
