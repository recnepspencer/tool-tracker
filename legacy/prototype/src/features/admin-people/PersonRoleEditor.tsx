import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/SelectField';
import { canEditPersonRole, MEMBER_ROLE_LABELS, MEMBER_ROLES, type MemberRole } from '../../domain/people';
import type { AdminPersonDetail } from '../../domain/read-models/admin';
import type { useAdminMutations } from '../admin/use-admin-people';

type RoleMutation = ReturnType<typeof useAdminMutations>['updateRole'];

export function PersonRoleEditor({
  person,
  commandBlocked,
  mutation,
}: {
  person: AdminPersonDetail;
  commandBlocked: boolean;
  mutation: RoleMutation;
}) {
  const [role, setRole] = useState<MemberRole>(person.role);
  const disabled = mutation.isPending || commandBlocked;
  return (
    <div className="admin-form">
      <SelectField
        label="Role"
        value={role}
        disabled={disabled}
        onChange={(next) => {
          mutation.reset();
          setRole(next as MemberRole);
        }}
        options={MEMBER_ROLES.map((value) => ({ value, label: MEMBER_ROLE_LABELS[value] }))}
      />
      <Button
        disabled={disabled || !canEditPersonRole(person.lifecycle) || role === person.role}
        onClick={() => void mutation.mutateAsync({ personId: person.id, role }).catch(() => undefined)}
      >
        Save role
      </Button>
      {mutation.error instanceof Error && <p className="form-error">{mutation.error.message}</p>}
    </div>
  );
}
