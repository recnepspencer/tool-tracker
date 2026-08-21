import type { HolderDto } from './http-holder-types';
import type { ToolLifecycle } from '../../domain/tool';
import type { HandoffKind } from '../../domain/custody';

export interface PendingHandoffDto {
  handoff_id: string;
  tool_unit_id: string;
  tool_name: string;
  image_url: string;
  from: HolderDto;
  to: HolderDto;
  requested_by_id: string;
  requested_by: string;
  requested_at: string;
  lifecycle: ToolLifecycle;
  kind?: HandoffKind;
  evidence?: { note?: string; mock_photo?: boolean };
}
