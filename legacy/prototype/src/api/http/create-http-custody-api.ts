import type { CustodyApi } from '../contracts/custody-api';
import type { HttpApiOptions } from './http-options';
import type { PendingHandoffDto } from './http-custody-types';
import { mapPendingHandoff } from './http-custody-mappers';
import type { CustodyMutationDto } from './http-custody-command-types';
import { mapCustodyMutation, type CustodyMutationOperation } from './http-custody-command-mappers';
import type { TransferTargetDto } from './http-transfer-target-types';
import { mapTransferTarget } from './http-transfer-target-mappers';
import { toEvidenceDto } from './http-evidence';
import { assertUniqueIds, pathWithBase, responseArray } from './http-transport';

interface MutationRequest {
  path: string;
  body: unknown;
  toolUnitId?: string;
  handoffId?: string;
  operation: CustodyMutationOperation;
}

export const createHttpCustodyApi = ({ transport, basePath = '/api' }: HttpApiOptions): CustodyApi => {
  const postMutation = async ({ path, body, toolUnitId, handoffId, operation }: MutationRequest) =>
    mapCustodyMutation(
      await transport.post<CustodyMutationDto>(pathWithBase(basePath, path), body),
      toolUnitId,
      handoffId,
      operation,
    );

  return {
    listPendingHandoffs: async (profileId) => {
      const handoffs = responseArray<PendingHandoffDto>(
        await transport.get(
          pathWithBase(basePath, '/tools/pending-handoffs?profile_id=' + encodeURIComponent(profileId)),
        ),
        'pending handoffs',
      ).map((handoff) => mapPendingHandoff(handoff, profileId));
      const uniqueHandoffs = assertUniqueIds(handoffs, 'pending handoff');
      const toolIds = handoffs.map((handoff) => handoff.toolUnitId);
      if (new Set(toolIds).size !== toolIds.length) throw new Error('Invalid API response: pending handoff tool ids');
      return uniqueHandoffs;
    },
    listTransferTargets: async ({ actorId, toolUnitId, handoffId }) => {
      const query =
        '?actor_id=' + encodeURIComponent(actorId) + (handoffId ? '&handoff_id=' + encodeURIComponent(handoffId) : '');
      const targets = responseArray<TransferTargetDto>(
        await transport.get(
          pathWithBase(basePath, '/tools/' + encodeURIComponent(toolUnitId) + '/transfer-targets' + query),
        ),
        'transfer targets',
      ).map(mapTransferTarget);
      const keys = targets.map((target) =>
        target.type === 'worker' ? 'worker:' + target.userId : 'warehouse:' + target.warehouseId,
      );
      if (new Set(keys).size !== keys.length) throw new Error('Invalid API response: transfer target ids');
      return targets;
    },
    requestTool: ({ actorId, toolUnitId, evidence }) =>
      postMutation({
        path: '/tools/' + encodeURIComponent(toolUnitId) + '/request',
        body: {
          actor_id: actorId,
          ...(toEvidenceDto(evidence) ? { evidence: toEvidenceDto(evidence) } : {}),
        },
        toolUnitId,
        operation: 'request',
      }),
    startTransfer: ({ actorId, toolUnitId, to, evidence }) =>
      postMutation({
        path: '/tools/' + encodeURIComponent(toolUnitId) + '/transfer',
        body: {
          actor_id: actorId,
          to: { kind: to.type, id: to.type === 'worker' ? to.userId : to.warehouseId },
          ...(toEvidenceDto(evidence) ? { evidence: toEvidenceDto(evidence) } : {}),
        },
        toolUnitId,
        operation: 'start-transfer',
      }),
    updateTransfer: ({ actorId, handoffId, toolUnitId, to, evidence }) =>
      postMutation({
        path: '/tools/handoffs/' + encodeURIComponent(handoffId) + '/edit',
        body: {
          actor_id: actorId,
          tool_unit_id: toolUnitId,
          to: { kind: to.type, id: to.type === 'worker' ? to.userId : to.warehouseId },
          ...(toEvidenceDto(evidence) ? { evidence: toEvidenceDto(evidence) } : {}),
        },
        toolUnitId,
        handoffId,
        operation: 'edit-transfer',
      }),
    acceptTransfer: ({ actorId, handoffId, toolUnitId, evidence }) =>
      postMutation({
        path: '/tools/handoffs/' + encodeURIComponent(handoffId) + '/accept',
        body: {
          actor_id: actorId,
          tool_unit_id: toolUnitId,
          ...(toEvidenceDto(evidence) ? { evidence: toEvidenceDto(evidence) } : {}),
        },
        toolUnitId,
        handoffId,
        operation: 'accept',
      }),
    declineTransfer: ({ actorId, handoffId, toolUnitId, evidence }) =>
      postMutation({
        path: '/tools/handoffs/' + encodeURIComponent(handoffId) + '/decline',
        body: {
          actor_id: actorId,
          tool_unit_id: toolUnitId,
          ...(toEvidenceDto(evidence) ? { evidence: toEvidenceDto(evidence) } : {}),
        },
        toolUnitId,
        handoffId,
        operation: 'decline',
      }),
    cancelTransfer: ({ actorId, handoffId, toolUnitId, evidence }) =>
      postMutation({
        path: '/tools/handoffs/' + encodeURIComponent(handoffId) + '/cancel',
        body: {
          actor_id: actorId,
          tool_unit_id: toolUnitId,
          ...(toEvidenceDto(evidence) ? { evidence: toEvidenceDto(evidence) } : {}),
        },
        toolUnitId,
        handoffId,
        operation: 'cancel',
      }),
    withdrawRequest: ({ actorId, handoffId, toolUnitId, evidence }) =>
      postMutation({
        path: '/tools/handoffs/' + encodeURIComponent(handoffId) + '/withdraw',
        body: {
          actor_id: actorId,
          tool_unit_id: toolUnitId,
          ...(toEvidenceDto(evidence) ? { evidence: toEvidenceDto(evidence) } : {}),
        },
        toolUnitId,
        handoffId,
        operation: 'withdraw',
      }),
    reportToolCondition: ({ actorId, toolUnitId, condition, evidence }) =>
      postMutation({
        path: '/tools/' + encodeURIComponent(toolUnitId) + '/condition',
        body: {
          actor_id: actorId,
          condition,
          ...(toEvidenceDto(evidence) ? { evidence: toEvidenceDto(evidence) } : {}),
        },
        toolUnitId,
        operation: 'report-condition',
      }),
  };
};
