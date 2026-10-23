import { ACTIVITY_KINDS, ACTIVITY_SCOPES, formatActivityTimestamp } from '../../domain/activity';
import type { ActivityView } from '../../domain/read-models/activity';
import type { ActivityDto } from './http-activity-types';
import { arrayValue, instantValue, nonBlankStringValue, oneOf } from './http-validation';
import { mapEvidenceDto } from './http-evidence';

export const mapActivity = (dto: ActivityDto): ActivityView => {
  const timestamp = instantValue(dto.occurred_at, 'activity timestamp');
  const evidence = mapEvidenceDto(dto.evidence, 'activity evidence');
  return {
    id: nonBlankStringValue(dto.event_id, 'activity id'),
    actorId: nonBlankStringValue(dto.actor_id, 'activity actor id'),
    actor: nonBlankStringValue(dto.actor_name, 'activity actor'),
    action: nonBlankStringValue(dto.action, 'activity action'),
    toolUnitId: nonBlankStringValue(dto.tool_unit_id, 'activity tool id'),
    toolName: nonBlankStringValue(dto.tool_name, 'activity tool'),
    imageSrc: nonBlankStringValue(dto.image_url, 'activity image'),
    time: formatActivityTimestamp(timestamp),
    timestamp,
    kind: oneOf(dto.kind, ACTIVITY_KINDS, 'activity kind'),
    scope: oneOf(dto.scope, ACTIVITY_SCOPES, 'activity scope'),
    participantIds: arrayValue<string>(dto.participant_ids, 'activity participants', (participantId, index) =>
      nonBlankStringValue(participantId, 'activity participant ' + index),
    ),
    warehouseId: nonBlankStringValue(dto.warehouse_id, 'activity warehouse id'),
    warehouseName: nonBlankStringValue(dto.warehouse_name, 'activity warehouse'),
    ...(evidence ? { evidence } : {}),
  };
};
