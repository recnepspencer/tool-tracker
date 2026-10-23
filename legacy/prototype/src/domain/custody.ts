import type { CustodyEvidence } from './evidence';

export type HolderRef = { type: 'worker'; userId: string } | { type: 'warehouse'; warehouseId: string };

export const HANDOFF_KINDS = ['warehouse-request', 'transfer'] as const;
export type HandoffKind = (typeof HANDOFF_KINDS)[number];

export const HANDOFF_STATUSES = ['pending', 'accepted', 'declined', 'cancelled', 'withdrawn'] as const;
export type HandoffStatus = (typeof HANDOFF_STATUSES)[number];

export const CUSTODY_MUTATION_STATUSES = [...HANDOFF_STATUSES, 'reported'] as const;
export type CustodyMutationStatus = (typeof CUSTODY_MUTATION_STATUSES)[number];

export const HANDOFF_ACTIONS = ['accept', 'decline', 'cancel', 'withdraw'] as const;
export type HandoffAction = (typeof HANDOFF_ACTIONS)[number];

export interface CustodyRecord {
  toolUnitId: string;
  holder: HolderRef;
  sinceAt: string;
}

export interface HandoffRequest {
  id: string;
  kind: HandoffKind;
  toolUnitId: string;
  from: HolderRef;
  to: HolderRef;
  requestedBy: string;
  requestedAt: string;
  status: HandoffStatus;
  evidence?: CustodyEvidence;
  resolutionEvidence?: CustodyEvidence;
  resolvedBy?: string;
  resolvedAt?: string;
}
