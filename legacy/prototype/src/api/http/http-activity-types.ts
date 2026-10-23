import type { ActivityView } from '../../domain/read-models/activity';
import type { EvidenceDto } from './http-evidence';

export interface ActivityDto {
  event_id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  tool_unit_id: string;
  tool_name: string;
  image_url: string;
  occurred_at: string;
  kind: ActivityView['kind'];
  scope: ActivityView['scope'];
  participant_ids: string[];
  warehouse_id: string;
  warehouse_name: string;
  evidence?: EvidenceDto;
}
