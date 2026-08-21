import { describe, expect, it } from 'vitest';
import type { AdminPersonView } from '../../domain/read-models/admin';
import { filterAdminPeople, type AdminPeopleFilters } from './people-selectors';

const people: AdminPersonView[] = [
  {
    id: 'ray-torres',
    name: 'Ray Torres',
    email: 'ray@nelson-electric.test',
    title: 'Field electrician',
    role: 'worker',
    lifecycle: 'active',
    homeWarehouseId: 'north-yard',
    homeWarehouse: 'North Yard',
    canAuthenticate: true,
    heldToolCount: 2,
    pendingHandoffCount: 0,
  },
  {
    id: 'sam-ochoa',
    name: 'Sam Ochoa',
    email: 'sam@nelson-electric.test',
    title: 'Operations administrator',
    role: 'admin',
    lifecycle: 'active',
    homeWarehouseId: 'north-yard',
    homeWarehouse: 'North Yard',
    canAuthenticate: true,
    heldToolCount: 0,
    pendingHandoffCount: 1,
  },
  {
    id: 'morgan-lee',
    name: 'Morgan Lee',
    email: 'morgan@nelson-electric.test',
    title: 'Warehouse manager',
    role: 'warehouse-manager',
    lifecycle: 'active',
    homeWarehouseId: 'south-yard',
    homeWarehouse: 'South Yard',
    canAuthenticate: false,
    heldToolCount: 0,
    pendingHandoffCount: 0,
  },
  {
    id: 'taylor-reed',
    name: 'Taylor Reed',
    email: 'taylor@nelson-electric.test',
    title: 'Former electrician',
    role: 'worker',
    lifecycle: 'removed',
    homeWarehouseId: 'south-yard',
    homeWarehouse: 'South Yard',
    canAuthenticate: false,
    heldToolCount: 0,
    pendingHandoffCount: 0,
  },
];

const filters = (overrides: Partial<AdminPeopleFilters> = {}): AdminPeopleFilters => ({
  search: '',
  lifecycle: 'all',
  role: 'all',
  capability: 'all',
  ...overrides,
});

describe('filterAdminPeople', () => {
  it('normalizes search across identity, title, warehouse, and role label', () => {
    expect(filterAdminPeople(people, filters({ search: '  NORTH YARD ' })).map((person) => person.id)).toEqual([
      'ray-torres',
      'sam-ochoa',
    ]);
    expect(filterAdminPeople(people, filters({ search: 'WAREHOUSE MANAGER' })).map((person) => person.id)).toEqual([
      'morgan-lee',
    ]);
    expect(
      filterAdminPeople(people, filters({ search: 'morgan@nelson-electric.test' })).map((person) => person.id),
    ).toEqual(['morgan-lee']);
  });

  it('applies lifecycle and role filters together', () => {
    expect(
      filterAdminPeople(people, filters({ lifecycle: 'active', role: 'worker' })).map((person) => person.id),
    ).toEqual(['ray-torres']);
    expect(filterAdminPeople(people, filters({ lifecycle: 'removed' })).map((person) => person.id)).toEqual([
      'taylor-reed',
    ]);
  });

  it('uses capability policy and authentication classification for access filters', () => {
    expect(filterAdminPeople(people, filters({ capability: 'admin-capable' })).map((person) => person.id)).toEqual([
      'sam-ochoa',
    ]);
    expect(filterAdminPeople(people, filters({ capability: 'no-access' })).map((person) => person.id)).toEqual([
      'morgan-lee',
      'taylor-reed',
    ]);
  });
});
