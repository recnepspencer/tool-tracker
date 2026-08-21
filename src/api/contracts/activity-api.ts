import type { ActivityView } from '../../domain/read-models/activity';

export interface ActivityApi {
  listActivity(): Promise<ActivityView[]>;
}
