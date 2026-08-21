import type { CustodyMutationResult } from '../contracts/custody-api';

export interface CustodyMutationDto {
  handoff_id?: string;
  tool_unit_id: string;
  event_id: string;
  status: CustodyMutationResult['status'];
}
