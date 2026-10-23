import type { AuditEventView } from '../../domain/read-models/activity';
import type { MemberLifecycle, MemberRole } from '../../domain/people';
import type { PermissionCapability, StructuralPermissionRule } from '../../domain/permission-policy';
import type { EvidenceDto } from './http-evidence';

export interface WarehouseDto {
  warehouse_id: string;
  name: string;
  address: string;
  manager_id: string;
  manager_name: string;
  stock_count: number;
  out_count: number;
}

export interface EventDto {
  event_id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  tool_unit_id?: string;
  tool_name?: string;
  image_url?: string;
  occurred_at: string;
  kind: AuditEventView['kind'];
  scope?: AuditEventView['scope'];
  warehouse_id?: string;
  warehouse_name?: string;
  evidence?: EvidenceDto;
}

export interface SummaryDto {
  total_tools: number;
  checked_out: number;
  in_stock: number;
  flagged: number;
  people: AdminPersonReferenceDto[];
  tools: AdminToolReferenceDto[];
  warehouses: WarehouseDto[];
  recent_events: EventDto[];
  pending_approvals: number;
  long_held_tools: HeldToolDto[];
}

export interface HeldToolDto {
  tool_unit_id: string;
  tool_name: string;
  holder_since: string;
  holder_since_at: string;
  warehouse_id: string;
  warehouse_name: string;
  status: 'checked-out' | 'damaged' | 'lost';
}

export interface PersonDto {
  person_id: string;
  display_name: string;
  email_address: string;
  job_title: string;
  role: MemberRole;
  lifecycle: MemberLifecycle;
  home_warehouse_id: string;
  home_warehouse: string;
  can_authenticate: boolean;
  held_tool_count: number;
  pending_handoff_count: number;
}

export interface PersonDetailDto extends PersonDto {
  held_tools: HeldToolDto[];
  recent_events: EventDto[];
}

export interface AdminWarehouseReferenceDto {
  warehouse_id: string;
  name: string;
}

export interface AdminPersonReferenceDto {
  person_id: string;
  display_name: string;
  role: MemberRole;
  lifecycle: MemberLifecycle;
}

export interface AdminToolReferenceDto {
  tool_unit_id: string;
  name: string;
}

export interface AdminPeopleResponseDto {
  people: PersonDto[];
  warehouses: AdminWarehouseReferenceDto[];
}

export interface AuditLogResponseDto {
  events: EventDto[];
}

export interface AdminPersonDetailResponseDto extends PersonDetailDto {
  warehouses: AdminWarehouseReferenceDto[];
  people: AdminPersonReferenceDto[];
  tools: AdminToolReferenceDto[];
}

export interface PermissionDto {
  role: MemberRole;
  label: string;
  capabilities: PermissionCapability[];
  structural_rules: StructuralPermissionRule[];
}

export interface AdminWarehouseDto extends WarehouseDto {
  manager_role: MemberRole;
  manager_lifecycle: MemberLifecycle;
}

export interface AdminWarehousesResponseDto {
  warehouses: AdminWarehouseDto[];
  people: AdminPersonReferenceDto[];
}

export interface MutationReceiptDto {
  operation: string;
  correlation_id: string;
  event_id: string;
  person_id?: string;
  warehouse_id?: string;
  affected_tool_unit_ids: string[];
  affected_handoff_ids: string[];
}
