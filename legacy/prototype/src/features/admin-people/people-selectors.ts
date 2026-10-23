import { MEMBER_ROLE_LABELS, canAuthenticate, type MemberLifecycle, type MemberRole } from '../../domain/people';
import { ADMINISTER_PEOPLE_CAPABILITY, memberHasCapability } from '../../domain/permission-policy';
import type { AdminPersonView } from '../../domain/read-models/admin';

export type AdminPeopleCapabilityFilter = 'all' | 'admin-capable' | 'no-access';

export interface AdminPeopleFilters {
  search: string;
  lifecycle: MemberLifecycle | 'all';
  role: MemberRole | 'all';
  capability: AdminPeopleCapabilityFilter;
}

const searchablePersonValues = (person: AdminPersonView) => [
  person.name,
  person.email,
  person.title,
  person.homeWarehouse,
  MEMBER_ROLE_LABELS[person.role],
];

export const filterAdminPeople = (people: AdminPersonView[], filters: AdminPeopleFilters): AdminPersonView[] => {
  const term = filters.search.trim().toLocaleLowerCase();
  return people.filter((person) => {
    const matchesText =
      !term || searchablePersonValues(person).some((value) => value.toLocaleLowerCase().includes(term));
    const matchesCapability =
      filters.capability === 'all' ||
      (filters.capability === 'admin-capable' && memberHasCapability(person.role, ADMINISTER_PEOPLE_CAPABILITY)) ||
      (filters.capability === 'no-access' && !canAuthenticate(person));
    return (
      matchesText &&
      (filters.lifecycle === 'all' || person.lifecycle === filters.lifecycle) &&
      (filters.role === 'all' || person.role === filters.role) &&
      matchesCapability
    );
  });
};
