import type { ActivityApi } from '../contracts/activity-api';
import { compareActivityTimestamps } from '../../domain/activity';
import type { HttpApiOptions } from './http-options';
import type { ActivityDto } from './http-activity-types';
import { mapActivity } from './http-activity-mappers';
import { assertUniqueIds, pathWithBase, responseArray } from './http-transport';

export const createHttpActivityApi = ({ transport, basePath = '/api' }: HttpApiOptions): ActivityApi => ({
  listActivity: async () =>
    assertUniqueIds(
      responseArray<ActivityDto>(await transport.get(pathWithBase(basePath, '/activity')), 'activity').map(mapActivity),
      'activity',
    ).sort((left, right) => compareActivityTimestamps(left.timestamp, right.timestamp)),
});
