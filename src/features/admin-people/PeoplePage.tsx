import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LoadingState, ErrorState } from '../../components/ui/AsyncState';
import { Button } from '../../components/ui/Button';
import { PageHeading } from '../../components/layout/PageHeading';
import { SearchField } from '../../components/ui/TextField';
import { SelectField } from '../../components/ui/SelectField';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import {
  MEMBER_LIFECYCLE_LABELS,
  MEMBER_ROLE_LABELS,
  MEMBER_ROLES,
  type MemberLifecycle,
  type MemberRole,
} from '../../domain/people';
import { useAdminPeople, useAdminPerson } from '../admin/use-admin-people';
import { PersonDrawer } from './PersonDrawer';
import { PeopleTable } from './PeopleTable';
import { InvitePersonDialog } from './InvitePersonDialog';
import { adminPersonPath } from './admin-person-path';
import { filterAdminPeople, type AdminPeopleCapabilityFilter } from './people-selectors';
import './admin-people.css';

export function PeoplePage() {
  const people = useAdminPeople();
  const { personId } = useParams();
  const detail = useAdminPerson(personId);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [lifecycle, setLifecycle] = useState<MemberLifecycle | 'all'>('all');
  const [roleFilter, setRoleFilter] = useState<MemberRole | 'all'>('all');
  const [capabilityFilter, setCapabilityFilter] = useState<AdminPeopleCapabilityFilter>('all');
  const [showInvite, setShowInvite] = useState(false);
  const rows = useMemo(
    () =>
      filterAdminPeople(people.data ?? [], {
        search,
        lifecycle,
        role: roleFilter,
        capability: capabilityFilter,
      }),
    [capabilityFilter, lifecycle, people.data, roleFilter, search],
  );
  if (people.isPending && !people.data) return <LoadingState label="Loading people…" />;
  if (!people.data)
    return <ErrorState message="The people directory could not be loaded." onRetry={() => void people.refetch()} />;
  return (
    <div className="page-content people-page">
      <PageHeading
        eyebrow="Admin view · People"
        title="People"
        description="Manage access, responsibility, and the history attached to every member."
      />
      {people.isError && (
        <ErrorState message="The people directory could not be refreshed." onRetry={() => void people.refetch()} />
      )}
      <div className="admin-toolbar">
        <div className="admin-filters">
          <SearchField label="Search people" placeholder="Search people…" value={search} onChange={setSearch} />
          <SelectField
            compact
            label="Filter lifecycle"
            value={lifecycle}
            onChange={(next) => setLifecycle(next as MemberLifecycle | 'all')}
            options={[
              { value: 'all', label: 'All access states' },
              ...Object.entries(MEMBER_LIFECYCLE_LABELS).map(([value, optionLabel]) => ({
                value,
                label: optionLabel,
              })),
            ]}
          />
          <SelectField
            compact
            label="Filter role"
            value={roleFilter}
            onChange={(next) => setRoleFilter(next as MemberRole | 'all')}
            options={[
              { value: 'all', label: 'All roles' },
              ...MEMBER_ROLES.map((value) => ({ value, label: MEMBER_ROLE_LABELS[value] })),
            ]}
          />
          <SelectField
            compact
            label="Filter capability"
            value={capabilityFilter}
            onChange={(next) => setCapabilityFilter(next as AdminPeopleCapabilityFilter)}
            options={[
              { value: 'all', label: 'All capabilities' },
              { value: 'admin-capable', label: 'Admin-capable' },
              { value: 'no-access', label: 'No access' },
            ]}
          />
        </div>
        <Button onClick={() => setShowInvite(true)}>Invite person</Button>
      </div>
      <SurfaceCard className="admin-table-card">
        <PeopleTable people={rows} onOpen={(id) => navigate(adminPersonPath(id))} />
        {!rows.length && <p className="admin-empty">No people match this filter.</p>}
      </SurfaceCard>
      {showInvite && <InvitePersonDialog onClose={() => setShowInvite(false)} />}
      {personId && detail.data && (
        <PersonDrawer
          person={detail.data}
          commandBlocked={
            people.isFetching ||
            people.isPaused ||
            people.isError ||
            detail.isFetching ||
            detail.isPaused ||
            detail.isError
          }
          onClose={() => navigate('/admin/people')}
        />
      )}
      {personId && detail.isError && (
        <ErrorState message="That person could not be loaded." onRetry={() => void detail.refetch()} />
      )}
    </div>
  );
}
