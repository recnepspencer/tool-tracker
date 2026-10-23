import { compareActivityTimestamps, parseCanonicalInstant } from '../../domain/activity';
import type {
  AdminPersonDetail,
  AdminPersonView,
  AdminSummary,
  AdminWarehouseView,
  PermissionMatrixRow,
  WarehouseCoverageView,
} from '../../domain/read-models/admin';
import { MEMBER_LIFECYCLES, MEMBER_ROLE_LABELS, MEMBER_ROLES, canAuthenticate } from '../../domain/people';
import {
  PERMISSION_CAPABILITIES,
  STRUCTURAL_PERMISSION_RULES,
  memberHasCapability,
  type PermissionCapability,
} from '../../domain/permission-policy';
import { isEligibleWarehouseManager } from '../../domain/warehouse';
import type {
  AdminPersonReferenceDto,
  PersonDetailDto,
  PersonDto,
  PermissionDto,
  SummaryDto,
  EventDto,
  HeldToolDto,
  AdminWarehouseDto,
  AdminPeopleResponseDto,
  AdminPersonDetailResponseDto,
  AdminWarehousesResponseDto,
  AdminWarehouseReferenceDto,
  WarehouseDto,
} from './http-admin-types';
import { assertUniqueIds } from './http-transport';
import { mapEvent, mapHeldTool } from './http-admin-event-mappers';
import {
  assertUniqueToolIds,
  knownPerson,
  knownWarehouse,
  parsePeopleReferences,
  parseToolReferences,
  personReferences,
  warehouseReferences,
  type PersonReferences,
  type ToolReferences,
  type WarehouseReferences,
} from './http-admin-references';
import { arrayValue, nonBlankStringValue, nonNegativeIntegerValue, oneOf } from './http-validation';

export const mapWarehouse = (warehouse: WarehouseDto): WarehouseCoverageView => ({
  id: nonBlankStringValue(warehouse.warehouse_id, 'warehouse id'),
  name: nonBlankStringValue(warehouse.name, 'warehouse name'),
  address: nonBlankStringValue(warehouse.address, 'warehouse address'),
  managerId: nonBlankStringValue(warehouse.manager_id, 'warehouse manager id'),
  manager: nonBlankStringValue(warehouse.manager_name, 'warehouse manager name'),
  tools: nonNegativeIntegerValue(warehouse.stock_count, 'warehouse stock count'),
  out: nonNegativeIntegerValue(warehouse.out_count, 'warehouse out count'),
});

const summaryCountsAreConsistent = ({
  totalTools,
  checkedOut,
  inStock,
  flagged,
}: {
  totalTools: number;
  checkedOut: number;
  inStock: number;
  flagged: number;
}) =>
  checkedOut <= totalTools &&
  inStock <= totalTools &&
  flagged <= totalTools &&
  checkedOut + inStock <= totalTools &&
  inStock + flagged <= totalTools &&
  totalTools <= checkedOut + inStock + flagged;

const summaryCoverageIsConsistent = (
  warehouses: WarehouseCoverageView[],
  { totalTools, checkedOut }: { totalTools: number; checkedOut: number },
) => {
  const stockAndOut = warehouses.reduce((total, warehouse) => total + warehouse.tools + warehouse.out, 0);
  const out = warehouses.reduce((total, warehouse) => total + warehouse.out, 0);
  return stockAndOut === totalTools && out === checkedOut;
};

const validateSummaryWarehouseManager = (warehouse: WarehouseDto, people: PersonReferences) => {
  const managerId = nonBlankStringValue(warehouse.manager_id, 'summary warehouse manager id');
  const managerName = nonBlankStringValue(warehouse.manager_name, 'summary warehouse manager name');
  const manager = people.get(managerId);
  if (!manager || manager.name !== managerName) {
    throw new Error('Invalid API response: summary warehouse manager reference');
  }
  if (!isEligibleWarehouseManager(manager)) {
    throw new Error('Invalid API response: summary warehouse manager');
  }
};

const mapPersonBase = (dto: PersonDto, references?: WarehouseReferences): AdminPersonView => {
  const role = oneOf(dto.role, MEMBER_ROLES, 'person role');
  const lifecycle = oneOf(dto.lifecycle, MEMBER_LIFECYCLES, 'person lifecycle');
  if (typeof dto.can_authenticate !== 'boolean') throw new Error('Invalid API response: person authentication');
  if (dto.can_authenticate !== canAuthenticate({ role, lifecycle })) {
    throw new Error('Invalid API response: person authentication');
  }
  const homeWarehouseId = nonBlankStringValue(dto.home_warehouse_id, 'person warehouse id');
  const homeWarehouse = nonBlankStringValue(dto.home_warehouse, 'person warehouse');
  knownWarehouse(references, homeWarehouseId, homeWarehouse, 'person warehouse');
  return {
    id: nonBlankStringValue(dto.person_id, 'person id'),
    name: nonBlankStringValue(dto.display_name, 'person name'),
    email: nonBlankStringValue(dto.email_address, 'person email'),
    title: nonBlankStringValue(dto.job_title, 'person title'),
    role,
    lifecycle,
    homeWarehouseId,
    homeWarehouse,
    canAuthenticate: dto.can_authenticate,
    heldToolCount: nonNegativeIntegerValue(dto.held_tool_count, 'person held tools'),
    pendingHandoffCount: nonNegativeIntegerValue(dto.pending_handoff_count, 'person pending handoffs'),
  };
};

export const mapPerson = mapPersonBase;

export const mapAdminPeopleResponse = (dto: AdminPeopleResponseDto): AdminPersonView[] => {
  const references = warehouseReferences(arrayValue<AdminWarehouseReferenceDto>(dto.warehouses, 'admin warehouses'));
  return assertUniqueIds(
    arrayValue<PersonDto>(dto.people, 'admin people').map((person) => mapPerson(person, references)),
    'person',
  );
};

export const mapPersonDetail = (
  dto: PersonDetailDto,
  warehouses?: WarehouseReferences,
  references?: { people?: PersonReferences; tools?: ToolReferences },
): AdminPersonDetail => {
  const person = mapPersonBase(dto, warehouses);
  const heldTools = assertUniqueToolIds(
    arrayValue<HeldToolDto>(dto.held_tools, 'person held tools').map((heldTool) =>
      mapHeldTool(heldTool, warehouses, references?.tools),
    ),
    'held tool',
  );
  if (heldTools.length !== person.heldToolCount) throw new Error('Invalid API response: person held tool count');
  const recentEvents = assertUniqueIds(
    arrayValue<EventDto>(dto.recent_events, 'person events').map((event) =>
      mapEvent(event, { warehouses, people: references?.people, tools: references?.tools }),
    ),
    'person event',
  ).sort(
    (left, right) => compareActivityTimestamps(left.timestamp, right.timestamp) || left.id.localeCompare(right.id),
  );
  return { ...person, heldTools, recentEvents };
};

export const mapAdminPersonDetailResponse = (
  dto: AdminPersonDetailResponseDto,
  expectedPersonId?: string,
): AdminPersonDetail => {
  const warehouses = warehouseReferences(arrayValue<AdminWarehouseReferenceDto>(dto.warehouses, 'admin warehouses'));
  const people = parsePeopleReferences(dto.people, 'admin people references');
  const tools = parseToolReferences(dto.tools, 'admin tool references');
  const detail = mapPersonDetail(dto, warehouses, { people, tools });
  if (expectedPersonId !== undefined && detail.id !== expectedPersonId) {
    throw new Error('Invalid API response: person detail reference');
  }
  return detail;
};

export const mapPermission = (dto: PermissionDto): PermissionMatrixRow => {
  const role = oneOf(dto.role, MEMBER_ROLES, 'permission role');
  const label = nonBlankStringValue(dto.label, 'permission label');
  const capabilities = arrayValue<PermissionCapability>(dto.capabilities, 'permission capabilities').map((capability) =>
    oneOf(capability, PERMISSION_CAPABILITIES, 'permission capability'),
  );
  if (new Set(capabilities).size !== capabilities.length)
    throw new Error('Invalid API response: permission capabilities');
  const structuralRules = arrayValue<PermissionMatrixRow['structuralRules'][number]>(
    dto.structural_rules,
    'permission structural rules',
  );
  if (JSON.stringify(structuralRules) !== JSON.stringify(STRUCTURAL_PERMISSION_RULES)) {
    throw new Error('Invalid API response: permission structural rules');
  }
  const expectedCapabilities = PERMISSION_CAPABILITIES.filter((capability) => memberHasCapability(role, capability));
  if (label !== MEMBER_ROLE_LABELS[role] || capabilities.join('|') !== expectedCapabilities.join('|')) {
    throw new Error('Invalid API response: permission policy');
  }
  return { role, label, capabilities, structuralRules: structuralRules.map((rule) => ({ ...rule })) };
};

export const mapPermissionMatrix = (items: PermissionDto[]): PermissionMatrixRow[] => {
  const permissions = assertUniqueIds(
    items.map((permission) => ({ ...mapPermission(permission), id: permission.role })),
    'permission role',
  );
  if (
    permissions.length !== MEMBER_ROLES.length ||
    !MEMBER_ROLES.every((role) => permissions.some((item) => item.id === role))
  ) {
    throw new Error('Invalid API response: permission roles');
  }
  return permissions.map(({ id: _id, ...permission }) => permission);
};

export const mapAdminWarehouse = (dto: AdminWarehouseDto, references?: PersonReferences): AdminWarehouseView => {
  const managerRole = oneOf(dto.manager_role, MEMBER_ROLES, 'warehouse manager role');
  const managerLifecycle = oneOf(dto.manager_lifecycle, MEMBER_LIFECYCLES, 'warehouse manager lifecycle');
  const managerId = nonBlankStringValue(dto.manager_id, 'warehouse manager id');
  const managerName = nonBlankStringValue(dto.manager_name, 'warehouse manager name');
  knownPerson(references, managerId, managerName, managerRole, managerLifecycle, 'warehouse manager');
  if (!isEligibleWarehouseManager({ role: managerRole, lifecycle: managerLifecycle })) {
    throw new Error('Invalid API response: warehouse manager');
  }
  return {
    ...mapWarehouse({ ...dto, manager_id: managerId, manager_name: managerName }),
    managerRole,
    managerLifecycle,
  };
};

export const mapAdminWarehousesResponse = (dto: AdminWarehousesResponseDto): AdminWarehouseView[] => {
  const references = personReferences(arrayValue<AdminPersonReferenceDto>(dto.people, 'admin people references'));
  return assertUniqueIds(
    arrayValue<AdminWarehouseDto>(dto.warehouses, 'admin warehouses').map((warehouse) =>
      mapAdminWarehouse(warehouse, references),
    ),
    'warehouse',
  );
};

export const mapSummary = (dto: SummaryDto): AdminSummary => {
  const totalTools = nonNegativeIntegerValue(dto.total_tools, 'summary total');
  const checkedOut = nonNegativeIntegerValue(dto.checked_out, 'summary checked out');
  const inStock = nonNegativeIntegerValue(dto.in_stock, 'summary stock');
  const flagged = nonNegativeIntegerValue(dto.flagged, 'summary flagged');
  if (!summaryCountsAreConsistent({ totalTools, checkedOut, inStock, flagged })) {
    throw new Error('Invalid API response: summary aggregate counts');
  }
  const people = parsePeopleReferences(dto.people, 'summary people references');
  const tools = parseToolReferences(dto.tools, 'summary tool references');
  const warehouses = assertUniqueIds(
    arrayValue<WarehouseDto>(dto.warehouses, 'summary warehouses').map((warehouse) => {
      const mapped = mapWarehouse(warehouse);
      validateSummaryWarehouseManager(warehouse, people);
      return mapped;
    }),
    'warehouse',
  );
  const warehouseRefs = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse.name]));
  if (!summaryCoverageIsConsistent(warehouses, { totalTools, checkedOut })) {
    throw new Error('Invalid API response: summary warehouse coverage');
  }
  const recentEvents = assertUniqueIds(
    arrayValue<EventDto>(dto.recent_events, 'summary events').map((event) =>
      mapEvent(event, { warehouses: warehouseRefs, people, tools }),
    ),
    'event',
  ).sort(
    (left, right) => compareActivityTimestamps(left.timestamp, right.timestamp) || left.id.localeCompare(right.id),
  );
  const longHeldTools = assertUniqueToolIds(
    arrayValue<HeldToolDto>(dto.long_held_tools, 'summary long-held tools').map((heldTool) =>
      mapHeldTool(heldTool, warehouseRefs, tools),
    ),
    'long-held tool',
  ).sort(
    (left, right) =>
      parseCanonicalInstant(left.holderSinceAt)! - parseCanonicalInstant(right.holderSinceAt)! ||
      left.toolUnitId.localeCompare(right.toolUnitId),
  );
  return {
    totalTools,
    checkedOut,
    inStock,
    flagged,
    warehouses,
    recentEvents,
    pendingApprovals: nonNegativeIntegerValue(dto.pending_approvals, 'summary pending approvals'),
    longHeldTools,
  };
};
