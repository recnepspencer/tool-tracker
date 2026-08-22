import { OverlayDialog } from '../../components/ui/OverlayDialog';
import { MEMBER_LIFECYCLE_LABELS, MEMBER_ROLE_LABELS } from '../../domain/people';
import type { AdminPersonDetail } from '../../domain/read-models/admin';
import { useAdminMutations } from '../admin/use-admin-people';
import { PersonAccessActions } from './PersonAccessActions';
import { PersonRemovalForm } from './PersonRemovalForm';
import { PersonRoleEditor } from './PersonRoleEditor';

export function PersonDrawer({
  person,
  commandBlocked = false,
  onClose,
}: {
  person: AdminPersonDetail;
  commandBlocked?: boolean;
  onClose(): void;
}) {
  const mutations = useAdminMutations();
  return (
    <OverlayDialog
      label={'Person details for ' + person.name}
      onClose={onClose}
      panelClassName="admin-drawer admin-drawer--person"
      showCloseButton
    >
      <div className="dialog-heading">
        <span className="eyebrow">Person record</span>
        <h2>{person.name}</h2>
        <p>
          {person.title} · {person.email}
        </p>
      </div>
      <div className="person-detail-grid">
        <div>
          <span className="eyebrow">Access</span>
          <strong>{MEMBER_LIFECYCLE_LABELS[person.lifecycle]}</strong>
        </div>
        <div>
          <span className="eyebrow">Role</span>
          <strong>{MEMBER_ROLE_LABELS[person.role]}</strong>
        </div>
        <div>
          <span className="eyebrow">Held tools</span>
          <strong>{person.heldTools.length}</strong>
        </div>
        <div>
          <span className="eyebrow">Home</span>
          <strong>{person.homeWarehouse}</strong>
        </div>
      </div>
      <PersonRoleEditor person={person} commandBlocked={commandBlocked} mutation={mutations.updateRole} />
      <div className="admin-detail-list">
        <span className="eyebrow">Custody held</span>
        {person.heldTools.map((tool) => (
          <div key={tool.toolUnitId}>
            <strong>{tool.toolName}</strong>
            <span>
              {tool.toolUnitId} · since {tool.holderSince}
            </span>
          </div>
        ))}
        {!person.heldTools.length && <span>No tools in this person’s custody.</span>}
      </div>
      {person.recentEvents.length ? (
        <div className="admin-detail-list">
          <span className="eyebrow">Recent audit</span>
          {person.recentEvents.slice(0, 5).map((event) => (
            <div key={event.id}>
              <strong>{event.action}</strong>
              <span>{event.time}</span>
            </div>
          ))}
        </div>
      ) : null}
      <PersonAccessActions person={person} commandBlocked={commandBlocked} mutation={mutations.setAccess} />
      <PersonRemovalForm person={person} commandBlocked={commandBlocked} mutation={mutations.remove} />
    </OverlayDialog>
  );
}
