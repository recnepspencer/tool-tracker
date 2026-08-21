import type { AuditEventView } from './activity';
import type { MemberLifecycle, MemberRole } from '../people';
import type { PermissionCapability, StructuralPermissionRule } from '../permission-policy';

export interface WarehouseCoverageView {
  id: string;
  name: string;
  address: string;
  managerId: string;
  manager: string;
  tools: number;
  out: number;
}

export interface AdminHeldToolView {
  toolUnitId: string;
  toolName: string;
  holderSince: string;
  holderSinceAt: string;
  warehouseId: string;
  warehouseName: string;
  status: 'checked-out' | 'damaged' | 'lost';
}

export interface AdminPersonView {
  id: string;
  name: string;
  email: string;
  title: string;
  role: MemberRole;
  lifecycle: MemberLifecycle;
  homeWarehouseId: string;
  homeWarehouse: string;
  canAuthenticate: boolean;
  heldToolCount: number;
  pendingHandoffCount: number;
}

export interface AdminPersonDetail extends AdminPersonView {
  heldTools: AdminHeldToolView[];
  recentEvents: AuditEventView[];
}

export interface PermissionMatrixRow {
  role: MemberRole;
  label: string;
  capabilities: PermissionCapability[];
  structuralRules: StructuralPermissionRule[];
}

export interface AdminWarehouseView extends WarehouseCoverageView {
  managerRole: MemberRole;
  managerLifecycle: MemberLifecycle;
}

export interface AdminSummary {
  totalTools: number;
  checkedOut: number;
  inStock: number;
  flagged: number;
  warehouses: WarehouseCoverageView[];
  recentEvents: AuditEventView[];
  pendingApprovals: number;
  longHeldTools: AdminHeldToolView[];
}
