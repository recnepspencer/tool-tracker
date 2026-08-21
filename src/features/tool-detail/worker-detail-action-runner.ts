import type { ReportConditionInput, RequestToolInput, StartTransferInput } from '../../api/contracts/custody-api';
import type { AuthSession } from '../../domain/auth';
import type { CustodyEvidence } from '../../domain/evidence';
import type { HolderRef } from '../../domain/custody';
import type { ToolHolderView } from '../../domain/read-models/holder';
import { holderSelectionKey } from './holder-selection-key';
import type { DetailAction } from './detail-action-types';

type AsyncMutation<Input> = { mutateAsync(input: Input): Promise<unknown> };

export interface WorkerDetailCommandMutations {
  requestTool: AsyncMutation<RequestToolInput>;
  startTransfer: AsyncMutation<StartTransferInput>;
  reportToolCondition: AsyncMutation<ReportConditionInput>;
}

export const buildWorkerActionEvidence = (note: string, mockPhoto: boolean): CustodyEvidence | undefined => {
  const normalizedNote = note.trim();
  return normalizedNote || mockPhoto
    ? { ...(normalizedNote ? { note: normalizedNote } : {}), ...(mockPhoto ? { mockPhoto: true } : {}) }
    : undefined;
};

export const submitWorkerDetailAction = async ({
  action,
  session,
  toolUnitId,
  target,
  targets,
  evidence,
  mutations,
}: {
  action: DetailAction;
  session: AuthSession;
  toolUnitId: string;
  target: string;
  targets: { data?: ToolHolderView[]; isPending: boolean; isFetching: boolean; isPaused: boolean; isError: boolean };
  evidence?: CustodyEvidence;
  mutations: WorkerDetailCommandMutations;
}) => {
  if (action === 'request') {
    await mutations.requestTool.mutateAsync({ toolUnitId, actorId: session.profileId, evidence });
    return 'Request sent to the warehouse.';
  }
  if (action === 'transfer') {
    if (targets.isPending || targets.isFetching || targets.isPaused || targets.isError) {
      throw new Error('Transfer destinations are not ready yet.');
    }
    const selectedTarget = targets.data?.find((candidate) => holderSelectionKey(candidate) === target);
    if (!selectedTarget) throw new Error('Choose a transfer destination before continuing.');
    const to: HolderRef =
      selectedTarget.type === 'worker'
        ? { type: 'worker', userId: selectedTarget.userId }
        : { type: 'warehouse', warehouseId: selectedTarget.warehouseId };
    await mutations.startTransfer.mutateAsync({ toolUnitId, actorId: session.profileId, to, evidence });
    return 'Transfer started. Custody moves after acceptance.';
  }
  if (action === 'report-damaged' || action === 'report-lost') {
    await mutations.reportToolCondition.mutateAsync({
      toolUnitId,
      actorId: session.profileId,
      condition: action === 'report-damaged' ? 'damaged' : 'lost',
      evidence,
    });
    return `Tool reported ${action === 'report-damaged' ? 'damaged' : 'lost'}.`;
  }
  throw new Error('Choose a transfer destination before continuing.');
};
