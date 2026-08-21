import { formatActivityTimestamp } from '../../domain/activity';
import { HANDOFF_KINDS } from '../../domain/custody';
import type { PendingHandoffView } from '../../domain/read-models/custody';
import { TOOL_LIFECYCLES } from '../../domain/tool';
import {
  canSeePendingHandoff,
  pendingHandoffActions,
  pendingHandoffDirection,
  sameHolder,
} from '../../domain/custody-policy';
import type { PendingHandoffDto } from './http-custody-types';
import { mapEvidenceDto } from './http-evidence';
import { instantValue, nonBlankStringValue, oneOf, required } from './http-validation';
import { mapHolder } from './http-holder-mapper';

export const mapPendingHandoff = (dto: PendingHandoffDto, expectedProfileId: string): PendingHandoffView => {
  const from = mapHolder(required(dto.from, 'handoff from'), 'handoff from');
  const to = mapHolder(required(dto.to, 'handoff to'), 'handoff to');
  const requestedById = nonBlankStringValue(dto.requested_by_id, 'handoff requester id');
  const requestedAtInstant = instantValue(dto.requested_at, 'handoff time');
  const lifecycle = oneOf(dto.lifecycle, TOOL_LIFECYCLES, 'handoff lifecycle');
  if (lifecycle !== 'active') throw new Error('Invalid API response: archived pending handoff');
  const kind = oneOf(
    dto.kind ?? (from.type === 'warehouse' ? 'warehouse-request' : 'transfer'),
    HANDOFF_KINDS,
    'handoff kind',
  );
  if (sameHolder(from, to)) throw new Error('Invalid API response: self-transfer handoff');
  const kindShape =
    kind === 'warehouse-request'
      ? from.type === 'warehouse' && to.type === 'worker' && requestedById === to.userId
      : from.type === 'worker' && requestedById === from.userId;
  if (!kindShape) throw new Error('Invalid API response: handoff kind and holders');
  const policyInput = { kind, from, to, requestedBy: requestedById, status: 'pending' as const };
  if (!canSeePendingHandoff(policyInput, expectedProfileId)) {
    throw new Error('Invalid API response: pending handoff profile');
  }
  const allowedActions = pendingHandoffActions(policyInput, expectedProfileId);
  const evidence = mapEvidenceDto(dto.evidence, 'handoff evidence');
  return {
    id: nonBlankStringValue(dto.handoff_id, 'handoff id'),
    kind,
    toolUnitId: nonBlankStringValue(dto.tool_unit_id, 'handoff tool id'),
    toolName: nonBlankStringValue(dto.tool_name, 'handoff tool'),
    imageSrc: nonBlankStringValue(dto.image_url, 'handoff image'),
    from,
    to,
    requestedById,
    requestedBy: nonBlankStringValue(dto.requested_by, 'handoff requester'),
    requestedAt: formatActivityTimestamp(requestedAtInstant),
    requestedAtInstant,
    ...(evidence ? { evidence } : {}),
    direction: pendingHandoffDirection(policyInput, expectedProfileId),
    allowedActions,
  };
};
