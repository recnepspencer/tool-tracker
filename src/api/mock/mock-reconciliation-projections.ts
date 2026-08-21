import type { HolderRef } from '../../domain/custody';
import type { ReconciliationBoardView } from '../../domain/read-models/reconciliation';
import type { ReconciliationIssueView } from '../../domain/reconciliation';
import type { MockState } from './mock-state';
import { compareActivityTimestamps } from '../../domain/activity';

const holderLabel = (state: MockState, holder: HolderRef) =>
  holder.type === 'worker'
    ? (state.users.find((user) => user.id === holder.userId)?.name ?? holder.userId)
    : (state.warehouses.find((warehouse) => warehouse.id === holder.warehouseId)?.name ?? holder.warehouseId);

export const projectReconciliation = (state: MockState): ReconciliationBoardView => {
  const projectedIssues = state.reconciliationIssues
    .map((issue): ReconciliationIssueView => {
      if (issue.kind === 'duplicate-tool-record') {
        const candidateNames = issue.candidateToolUnitIds.map((unitId) => {
          const unit = state.units.find((candidate) => candidate.id === unitId);
          const definition = unit
            ? state.definitions.find((candidate) => candidate.id === unit.definitionId)
            : undefined;
          return (definition?.name ?? 'Unknown tool') + ' · ' + unitId;
        }) as [string, string];
        const candidateRevisions = issue.candidateToolUnitIds.map(
          (unitId) => state.units.find((unit) => unit.id === unitId)?.revision ?? 1,
        ) as [number, number];
        const candidateHolders = issue.candidateToolUnitIds.map(
          (unitId) => state.custody.find((record) => record.toolUnitId === unitId)?.holder,
        ) as [HolderRef, HolderRef];
        return {
          ...issue,
          candidateToolUnitIds: [...issue.candidateToolUnitIds] as [string, string],
          candidateNames,
          candidateRevisions,
          candidateHolders: candidateHolders.map((holder) => ({ ...holder })) as [HolderRef, HolderRef],
        };
      }
      const unit = state.units.find((candidate) => candidate.id === issue.toolUnitId);
      const definition = unit ? state.definitions.find((candidate) => candidate.id === unit.definitionId) : undefined;
      return {
        ...issue,
        recordedHolder: { ...issue.recordedHolder },
        observedHolder: { ...issue.observedHolder },
        toolName: definition?.name ?? 'Unknown tool',
        recordedLabel: holderLabel(state, issue.recordedHolder),
        observedLabel: holderLabel(state, issue.observedHolder),
        toolRevision: unit?.revision ?? 1,
      };
    })
    .sort((left, right) => {
      return compareActivityTimestamps(left.detectedAt, right.detectedAt) || left.id.localeCompare(right.id);
    });
  return {
    issues: projectedIssues.filter((issue) => issue.status === 'open'),
    openCount: projectedIssues.filter((issue) => issue.status === 'open').length,
    resolvedCount: projectedIssues.filter((issue) => issue.status === 'resolved').length,
  };
};
