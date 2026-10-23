import type {
  AdminPersonDetail,
  AdminPersonView,
  AdminSummary,
  AdminWarehouseView,
  PermissionMatrixRow,
} from '../../domain/read-models/admin';
import type { AdminMutationReceipt } from '../../domain/admin-mutation';
import type { MemberRole, PersonAccessState } from '../../domain/people';
import type { AuditEventView } from '../../domain/read-models/activity';

export interface AdminActorInput {
  actorId: string;
}

export interface InvitePersonInput extends AdminActorInput {
  name: string;
  email: string;
  title: string;
  role: MemberRole;
  homeWarehouseId: string;
}

export interface UpdatePersonRoleInput extends AdminActorInput {
  personId: string;
  role: MemberRole;
}

export interface SetPersonAccessInput extends AdminActorInput {
  personId: string;
  access: PersonAccessState;
}

export interface RemovePersonInput extends AdminActorInput {
  personId: string;
  reason: string;
  note?: string;
}

export interface CreateWarehouseInput extends AdminActorInput {
  name: string;
  address: string;
  managerId: string;
}

export interface UpdateWarehouseInput extends CreateWarehouseInput {
  warehouseId: string;
}

export interface AdminApi {
  getSummary(input: AdminActorInput): Promise<AdminSummary>;
  listPeople(input: AdminActorInput): Promise<AdminPersonView[]>;
  getPerson(input: AdminActorInput & { personId: string }): Promise<AdminPersonDetail>;
  getPermissionMatrix(input: AdminActorInput): Promise<PermissionMatrixRow[]>;
  listWarehouses(input: AdminActorInput): Promise<AdminWarehouseView[]>;
  listAuditLog(input: AdminActorInput): Promise<AuditEventView[]>;
  invitePerson(input: InvitePersonInput): Promise<AdminMutationReceipt>;
  updatePersonRole(input: UpdatePersonRoleInput): Promise<AdminMutationReceipt>;
  setPersonAccess(input: SetPersonAccessInput): Promise<AdminMutationReceipt>;
  removePerson(input: RemovePersonInput): Promise<AdminMutationReceipt>;
  createWarehouse(input: CreateWarehouseInput): Promise<AdminMutationReceipt>;
  updateWarehouse(input: UpdateWarehouseInput): Promise<AdminMutationReceipt>;
}
