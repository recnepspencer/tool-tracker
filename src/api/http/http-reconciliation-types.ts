import type { HolderDto } from './http-holder-types';

export interface ReconciliationIssueDto {
  issue_id: string;
  kind: 'duplicate-tool-record' | 'custody-mismatch';
  candidate_tool_unit_ids?: [string, string];
  candidate_names?: [string, string];
  candidate_revisions?: [number, number];
  candidate_holders?: [HolderDto, HolderDto];
  tool_unit_id?: string;
  tool_name?: string;
  recorded_holder?: HolderDto;
  observed_holder?: HolderDto;
  recorded_label?: string;
  observed_label?: string;
  tool_revision?: number;
  reason: string;
  detected_at: string;
  revision: number;
  status: 'open' | 'resolved';
}

export interface ReconciliationResponseDto {
  issues: ReconciliationIssueDto[];
  open_count: number;
  resolved_count: number;
}

export interface ReconciliationReceiptDto {
  operation: string;
  correlation_id: string;
  event_id: string;
  issue_id: string;
  affected_tool_unit_ids: string[];
}
