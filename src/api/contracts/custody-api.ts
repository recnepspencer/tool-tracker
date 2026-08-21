import type { CustodyMutationStatus, HolderRef } from '../../domain/custody';
import type { CustodyEvidence } from '../../domain/evidence';
import type { ConditionReportKind } from '../../domain/condition-report';
import type { PendingHandoffView } from '../../domain/read-models/custody';
import type { ToolHolderView } from '../../domain/read-models/holder';

export interface CustodyMutationResult {
  handoffId?: string;
  toolUnitId: string;
  eventId: string;
  status: CustodyMutationStatus;
}

export interface RequestToolInput {
  toolUnitId: string;
  actorId: string;
  evidence?: CustodyEvidence;
}

export interface StartTransferInput {
  toolUnitId: string;
  actorId: string;
  to: HolderRef;
  evidence?: CustodyEvidence;
}

export interface HandoffReviewInput {
  handoffId: string;
  toolUnitId: string;
  actorId: string;
  evidence?: CustodyEvidence;
}

export interface ReportConditionInput {
  toolUnitId: string;
  actorId: string;
  condition: ConditionReportKind;
  evidence?: CustodyEvidence;
}

export interface CustodyApi {
  listPendingHandoffs(profileId: string): Promise<PendingHandoffView[]>;
  listTransferTargets(input: { actorId: string; toolUnitId: string }): Promise<ToolHolderView[]>;
  requestTool(input: RequestToolInput): Promise<CustodyMutationResult>;
  startTransfer(input: StartTransferInput): Promise<CustodyMutationResult>;
  acceptTransfer(input: HandoffReviewInput): Promise<CustodyMutationResult>;
  declineTransfer(input: HandoffReviewInput): Promise<CustodyMutationResult>;
  cancelTransfer(input: HandoffReviewInput): Promise<CustodyMutationResult>;
  withdrawRequest(input: HandoffReviewInput): Promise<CustodyMutationResult>;
  reportToolCondition(input: ReportConditionInput): Promise<CustodyMutationResult>;
}
