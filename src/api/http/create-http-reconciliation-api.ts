import type { ReconciliationApi } from '../contracts/reconciliation-api';
import type { HttpApiOptions } from './http-options';
import { pathWithBase } from './http-transport';
import type { ReconciliationResponseDto, ReconciliationReceiptDto } from './http-reconciliation-types';
import { mapReconciliation, mapReconciliationReceipt } from './http-reconciliation-mappers';
import { holderBody } from './http-reconciliation-command-mappers';

const actorQuery = (actorId: string) => '?actor_id=' + encodeURIComponent(actorId);

export const createHttpReconciliationApi = ({ transport, basePath = '/api' }: HttpApiOptions): ReconciliationApi => ({
  listIssues: async ({ actorId }) =>
    mapReconciliation(
      await transport.get<ReconciliationResponseDto>(
        pathWithBase(basePath, '/admin/reconciliation' + actorQuery(actorId)),
      ),
    ),
  dismissDuplicate: async ({ actorId, issueId, expectedIssueRevision, note }) =>
    mapReconciliationReceipt(
      await transport.post<ReconciliationReceiptDto>(
        pathWithBase(basePath, '/admin/reconciliation/' + encodeURIComponent(issueId) + '/dismiss'),
        { actor_id: actorId, expected_issue_revision: expectedIssueRevision, ...(note ? { note } : {}) },
      ),
      { operation: 'dismiss-duplicate', issueId, affectedToolUnitIds: [] },
    ),
  mergeDuplicate: async (input) =>
    mapReconciliationReceipt(
      await transport.post<ReconciliationReceiptDto>(
        pathWithBase(basePath, '/admin/reconciliation/' + encodeURIComponent(input.issueId) + '/merge'),
        {
          actor_id: input.actorId,
          expected_issue_revision: input.expectedIssueRevision,
          survivor_tool_unit_id: input.survivorToolUnitId,
          retired_tool_unit_id: input.retiredToolUnitId,
          expected_survivor_revision: input.expectedSurvivorRevision,
          expected_retired_revision: input.expectedRetiredRevision,
          expected_survivor_holder: holderBody(input.expectedSurvivorHolder),
          expected_retired_holder: holderBody(input.expectedRetiredHolder),
          ...(input.note ? { note: input.note } : {}),
        },
      ),
      {
        operation: 'merge-duplicate',
        issueId: input.issueId,
        affectedToolUnitIds: [input.survivorToolUnitId, input.retiredToolUnitId],
      },
    ),
  resolveCustodyMismatch: async (input) =>
    mapReconciliationReceipt(
      await transport.post<ReconciliationReceiptDto>(
        pathWithBase(basePath, '/admin/reconciliation/' + encodeURIComponent(input.issueId) + '/resolve-custody'),
        {
          actor_id: input.actorId,
          expected_issue_revision: input.expectedIssueRevision,
          tool_unit_id: input.toolUnitId,
          expected_tool_revision: input.expectedToolRevision,
          expected_recorded_holder: holderBody(input.expectedRecordedHolder),
          decision: input.decision,
          ...(input.note ? { note: input.note } : {}),
        },
      ),
      { operation: 'resolve-custody-mismatch', issueId: input.issueId, affectedToolUnitIds: [input.toolUnitId] },
    ),
});
