export const ADMIN_MUTATION_OPERATIONS = {
  invitePerson: 'invite-person',
  updatePersonRole: 'update-person-role',
  setPersonAccess: 'set-person-access',
  removePerson: 'remove-person',
  createWarehouse: 'create-warehouse',
  updateWarehouse: 'update-warehouse',
  updateCompany: 'update-company',
  createCategory: 'create-category',
  renameCategory: 'rename-category',
  deleteCategory: 'delete-category',
} as const;

export type AdminMutationOperation = (typeof ADMIN_MUTATION_OPERATIONS)[keyof typeof ADMIN_MUTATION_OPERATIONS];

export const ADMIN_MUTATION_OPERATION_VALUES = [
  ADMIN_MUTATION_OPERATIONS.invitePerson,
  ADMIN_MUTATION_OPERATIONS.updatePersonRole,
  ADMIN_MUTATION_OPERATIONS.setPersonAccess,
  ADMIN_MUTATION_OPERATIONS.removePerson,
  ADMIN_MUTATION_OPERATIONS.createWarehouse,
  ADMIN_MUTATION_OPERATIONS.updateWarehouse,
  ADMIN_MUTATION_OPERATIONS.updateCompany,
  ADMIN_MUTATION_OPERATIONS.createCategory,
  ADMIN_MUTATION_OPERATIONS.renameCategory,
  ADMIN_MUTATION_OPERATIONS.deleteCategory,
] as const satisfies readonly AdminMutationOperation[];

export const ADMIN_PERSON_MUTATION_OPERATIONS = [
  ADMIN_MUTATION_OPERATIONS.invitePerson,
  ADMIN_MUTATION_OPERATIONS.updatePersonRole,
  ADMIN_MUTATION_OPERATIONS.setPersonAccess,
  ADMIN_MUTATION_OPERATIONS.removePerson,
] as const satisfies readonly AdminMutationOperation[];

export const ADMIN_WAREHOUSE_MUTATION_OPERATIONS = [
  ADMIN_MUTATION_OPERATIONS.createWarehouse,
  ADMIN_MUTATION_OPERATIONS.updateWarehouse,
] as const satisfies readonly AdminMutationOperation[];

export type AdminMutationTarget = 'person' | 'warehouse' | 'settings';

export const SETTING_MUTATION_OPERATIONS = [
  ADMIN_MUTATION_OPERATIONS.updateCompany,
  ADMIN_MUTATION_OPERATIONS.createCategory,
  ADMIN_MUTATION_OPERATIONS.renameCategory,
  ADMIN_MUTATION_OPERATIONS.deleteCategory,
] as const;

export const adminMutationTarget = (operation: AdminMutationOperation): AdminMutationTarget =>
  ADMIN_PERSON_MUTATION_OPERATIONS.includes(operation as (typeof ADMIN_PERSON_MUTATION_OPERATIONS)[number])
    ? 'person'
    : SETTING_MUTATION_OPERATIONS.includes(operation as (typeof SETTING_MUTATION_OPERATIONS)[number])
      ? 'settings'
      : 'warehouse';

export const adminMutationCorrelation = (eventId: string) => 'ADM-' + eventId;
export const settingsMutationCorrelation = (eventId: string) => 'SET-' + eventId;

export interface AdminMutationReceipt {
  operation: AdminMutationOperation;
  correlationId: string;
  eventId: string;
  personId?: string;
  warehouseId?: string;
  affectedToolUnitIds: string[];
  affectedHandoffIds: string[];
}
