import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LoadingState, ErrorState } from '../../components/ui/AsyncState';
import { Button } from '../../components/ui/Button';
import { PageHeading } from '../../components/layout/PageHeading';
import { DirectoryToolbar } from '../../components/layout/DirectoryToolbar';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { useAdminPeople, useAdminPerson } from '../admin/use-admin-people';
import { PersonDrawer } from './PersonDrawer';
import { PeopleTable } from './PeopleTable';
import { InvitePersonDialog } from './InvitePersonDialog';
import { adminPersonPath } from './admin-person-path';
import { filterAdminPeople } from './people-selectors';
import './admin-people.css';

export function PeoplePage() {
  const people = useAdminPeople();
  const { personId } = useParams();
  const detail = useAdminPerson(personId);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'everyone' | 'invited' | 'admins' | 'no-access'>('everyone');
  const [showInvite, setShowInvite] = useState(false);
  const rows = useMemo(
    () =>
      filterAdminPeople(people.data ?? [], {
        search,
        lifecycle: filter === 'invited' ? 'invited' : 'all',
        role: 'all',
        capability: filter === 'no-access' ? 'no-access' : 'all',
      }).filter((person) => filter !== 'admins' || person.role !== 'worker'),
    [filter, people.data, search],
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
        action={<Button onClick={() => setShowInvite(true)}>Invite person</Button>}
      />
      {people.isError && (
        <ErrorState message="The people directory could not be refreshed." onRetry={() => void people.refetch()} />
      )}
      <DirectoryToolbar<'everyone' | 'invited' | 'admins' | 'no-access'>
        searchLabel="Search people"
        searchPlaceholder="Search people…"
        search={search}
        onSearchChange={setSearch}
        filterLabel="People filter"
        filters={[
          { value: 'everyone', label: 'Everyone' },
          { value: 'invited', label: 'Invited' },
          { value: 'admins', label: 'Admins' },
          { value: 'no-access', label: 'No access' },
        ]}
        activeFilter={filter}
        onFilterChange={setFilter}
      />
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
