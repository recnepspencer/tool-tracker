import { compareActivityTimestamps } from '../../domain/activity';
import type { ActivityApi } from '../contracts/activity-api';
import { toActivityView } from './mock-activity-projections';
import type { MockDatabase } from './mock-database';

export const createMockActivityApi = (database: MockDatabase): ActivityApi => ({
  listActivity: async () => {
    const state = database.read();
    return state.events
      .filter((event) => event.toolUnitId !== undefined)
      .map((event) => toActivityView(state, event.id))
      .sort((left, right) => compareActivityTimestamps(left.timestamp, right.timestamp));
  },
});
