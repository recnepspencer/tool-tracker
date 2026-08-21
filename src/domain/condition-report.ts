import type { CustodyEvidence } from './evidence';

export const CONDITION_REPORTS = ['damaged', 'lost'] as const;
export type ConditionReportKind = (typeof CONDITION_REPORTS)[number];

export interface ConditionReport {
  id: string;
  toolUnitId: string;
  reporterId: string;
  condition: ConditionReportKind;
  reportedAt: string;
  evidence?: CustodyEvidence;
}
