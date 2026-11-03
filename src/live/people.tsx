import { Link } from 'react-router-dom';
import { formatDate } from './format';
import { Button, DirectoryToolbar, ErrorState, LoadingState, OverlayDialog, PageHeading, SurfaceCard } from './kit';
import { PersonDrawer } from './people-drawer';
import { InvitePersonDialog } from './people-invite';
import { LIFECYCLE_LABELS, LIFECYCLE_PILL, ROLE_LABELS, memberLifecycle, memberRoles } from './people-roles';
import { usePeoplePageState, type InvitationState, type PeopleFilter } from './people-state';
import { CommandError } from './settings-command';

const INVITATION_LABELS: Record<InvitationState, string> = {
  invited: 'Invited',
  expired: 'Expired',
  revoked: 'Revoked',
  accepted: 'Accepted',
};
const INVITATION_PILL: Record<InvitationState, string> = {
  invited: 'invited',
  expired: 'suspended',
  revoked: 'removed',
  accepted: 'active',
};
const FILTERS: { value: PeopleFilter; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'invited', label: 'Invited' },
  { value: 'admins', label: 'Admins' },
  { value: 'no-access', label: 'No access' },
];

export function PeoplePage() {
  const state = usePeoplePageState();
  const { c, people, invites, assets, rows, selected, revoking, revoke } = state;
  const manages = c.can('people.manage');
  const showCustody = c.can('tools.read');
  if (people.isPending && !people.data) return <LoadingState label="Loading people…" />;
  if (!people.data)
    return <ErrorState message="The people directory could not be loaded." onRetry={() => void people.refetch()} />;
  return (
    <div className="page-content people-page">
      <PageHeading
        eyebrow="Admin view · People"
        title="People"
        description="Manage access, responsibility, and the history attached to every member."
        action={manages ? <Button onClick={() => state.invite(true)}>Invite person</Button> : undefined}
      />
      {people.isError && (
        <ErrorState message="The people directory could not be refreshed." onRetry={() => void people.refetch()} />
      )}
      {invites.isError && (
        <ErrorState message="Invitations could not be loaded." onRetry={() => void invites.refetch()} />
      )}
      {assets.isError && (
        <ErrorState message="Custody counts could not be loaded." onRetry={() => void assets.refetch()} />
      )}
      <DirectoryToolbar<PeopleFilter>
        searchLabel="Search people"
        searchPlaceholder="Search people…"
        search={state.search}
        onSearchChange={state.setSearch}
        filterLabel="People filter"
        filters={FILTERS}
        activeFilter={state.filter}
        onFilterChange={state.setFilter}
      />
      <SurfaceCard className="admin-table-card">
        <div className="admin-table-wrap">
          <table className="admin-table admin-table--responsive directory-table people-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th>Access</th>
                {showCustody && <th>Custody</th>}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                if (row.kind === 'member') {
                  const person = row.member;
                  const lifecycle = memberLifecycle(person);
                  const custody = state.custody(person.id);
                  return (
                    <tr key={row.id}>
                      <td data-label="Person">
                        <Link className="admin-person-link" to={state.personHref(person.id)} replace>
                          {person.preferred_name}
                        </Link>
                        {person.title && <span>{person.title}</span>}
                        <span className="people-table__mobile-meta">
                          {memberRoles(person)}
                          {custody ? ` · ${custody}` : ''}
                        </span>
                      </td>
                      <td className="directory-table__mobile-hide" data-label="Role">
                        {memberRoles(person)}
                      </td>
                      <td className="directory-table__status" data-label="Access">
                        <span className={'lifecycle-pill lifecycle-pill--' + LIFECYCLE_PILL[lifecycle]}>
                          {LIFECYCLE_LABELS[lifecycle]}
                        </span>
                      </td>
                      {showCustody && (
                        <td className="directory-table__mobile-hide" data-label="Custody">
                          {custody ?? '—'}
                        </td>
                      )}
                      <td className="directory-table__actions" data-label="Actions">
                        <Button
                          variant="ghost"
                          onClick={() => state.select(person.id)}
                          aria-label={`Open ${person.preferred_name}`}
                        >
                          Open
                        </Button>
                      </td>
                    </tr>
                  );
                }
                const { invite, state: status } = row;
                const expiry =
                  status === 'invited'
                    ? `Expires ${formatDate(invite.expires_at)}`
                    : status === 'expired'
                      ? `Expired ${formatDate(invite.expires_at)}`
                      : '';
                return (
                  <tr key={row.id}>
                    <td data-label="Person">
                      <strong>{invite.preferred_name}</strong>
                      <span>
                        {invite.email}
                        {expiry ? ` · ${expiry}` : ''}
                      </span>
                      <span className="people-table__mobile-meta">
                        {invite.grants_ownership
                          ? `Owner, ${ROLE_LABELS[invite.role_code]}`
                          : ROLE_LABELS[invite.role_code]}
                      </span>
                    </td>
                    <td className="directory-table__mobile-hide" data-label="Role">
                      {invite.grants_ownership
                        ? `Owner, ${ROLE_LABELS[invite.role_code]}`
                        : ROLE_LABELS[invite.role_code]}
                    </td>
                    <td className="directory-table__status" data-label="Access">
                      <span className={'lifecycle-pill lifecycle-pill--' + INVITATION_PILL[status]}>
                        {INVITATION_LABELS[status]}
                      </span>
                    </td>
                    {showCustody && (
                      <td className="directory-table__mobile-hide" data-label="Custody">
                        None
                      </td>
                    )}
                    <td className="directory-table__actions" data-label="Actions">
                      {status === 'invited' && manages && (
                        <Button
                          variant="ghost"
                          onClick={() => state.startRevoke(invite.id)}
                          aria-label={`Revoke invitation for ${invite.preferred_name}`}
                        >
                          Revoke
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!rows.length && <p className="admin-empty">No people match this filter.</p>}
      </SurfaceCard>
      {manages && state.inviting && <InvitePersonDialog onClose={() => state.invite(false)} />}
      {selected && <PersonDrawer key={selected.id} person={selected} state={state} onClose={() => state.select('')} />}
      {revoking && (
        <OverlayDialog
          label="Revoke invitation"
          onClose={() => !revoke.busy && state.cancelRevoke()}
          panelClassName="admin-dialog"
          showCloseButton
        >
          <div className="dialog-heading">
            <span className="eyebrow">People</span>
            <h2>Revoke {revoking.preferred_name}’s invitation?</h2>
            <p>The invitation link stops working. You can invite {revoking.email} again later.</p>
          </div>
          <CommandError error={revoke.error} />
          <div className="dialog-actions">
            <Button variant="ghost" onClick={state.cancelRevoke} disabled={revoke.busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => state.confirmRevoke(revoking)} disabled={revoke.busy}>
              {revoke.busy ? 'Revoking…' : 'Revoke invitation'}
            </Button>
          </div>
        </OverlayDialog>
      )}
    </div>
  );
}
