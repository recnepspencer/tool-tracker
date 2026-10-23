import { describe, expect, it } from 'vitest';
import { queryKeys } from '../../api/query-keys';
import { adminSummaryQueryKeyFor, adminSummaryRootQueryKey } from './use-admin-summary';

describe('admin summary query key authority', () => {
  it('exposes an actor-scoped key factory and a distinct invalidation root', () => {
    expect(adminSummaryQueryKeyFor('sam-ochoa')).toEqual(queryKeys.adminSummaryFor('sam-ochoa'));
    expect(adminSummaryRootQueryKey).toEqual(queryKeys.adminSummary);
    expect(adminSummaryQueryKeyFor('sam-ochoa')).not.toEqual(adminSummaryRootQueryKey);
  });
});
