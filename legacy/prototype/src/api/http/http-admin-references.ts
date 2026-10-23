import { MEMBER_LIFECYCLES, MEMBER_ROLES } from '../../domain/people';
import type { AdminPersonReferenceDto, AdminToolReferenceDto, AdminWarehouseReferenceDto } from './http-admin-types';
import { arrayValue, nonBlankStringValue, oneOf } from './http-validation';

export type WarehouseReferences = ReadonlyMap<string, string>;
export type PersonReferences = ReadonlyMap<
  string,
  { name: string; role: (typeof MEMBER_ROLES)[number]; lifecycle: (typeof MEMBER_LIFECYCLES)[number] }
>;
export type ToolReferences = ReadonlyMap<string, string>;

export interface EventReferences {
  warehouses?: WarehouseReferences;
  people?: PersonReferences;
  tools?: ToolReferences;
}

export const assertUniqueToolIds = <T extends { toolUnitId: string }>(items: T[], label: string) => {
  if (new Set(items.map((item) => item.toolUnitId)).size !== items.length) {
    throw new Error('Invalid API response: ' + label + ' ids');
  }
  return items;
};

export const warehouseReferences = (items: AdminWarehouseReferenceDto[]): WarehouseReferences => {
  const references = new Map<string, string>();
  items.forEach((item) => {
    const id = nonBlankStringValue(item.warehouse_id, 'admin warehouse reference id');
    const name = nonBlankStringValue(item.name, 'admin warehouse reference name');
    if (references.has(id)) throw new Error('Invalid API response: duplicate admin warehouse reference');
    references.set(id, name);
  });
  return references;
};

export const personReferences = (items: AdminPersonReferenceDto[]): PersonReferences => {
  const references = new Map<
    string,
    { name: string; role: (typeof MEMBER_ROLES)[number]; lifecycle: (typeof MEMBER_LIFECYCLES)[number] }
  >();
  items.forEach((item) => {
    const id = nonBlankStringValue(item.person_id, 'admin person reference id');
    const name = nonBlankStringValue(item.display_name, 'admin person reference name');
    const role = oneOf(item.role, MEMBER_ROLES, 'admin person reference role');
    const lifecycle = oneOf(item.lifecycle, MEMBER_LIFECYCLES, 'admin person reference lifecycle');
    if (references.has(id)) throw new Error('Invalid API response: duplicate admin person reference');
    references.set(id, { name, role, lifecycle });
  });
  return references;
};

export const toolReferences = (items: AdminToolReferenceDto[]): ToolReferences => {
  const references = new Map<string, string>();
  items.forEach((item) => {
    const id = nonBlankStringValue(item.tool_unit_id, 'admin tool reference id');
    const name = nonBlankStringValue(item.name, 'admin tool reference name');
    if (references.has(id)) throw new Error('Invalid API response: duplicate admin tool reference');
    references.set(id, name);
  });
  return references;
};

export const knownWarehouse = (
  references: WarehouseReferences | undefined,
  id: string,
  name: string,
  label: string,
) => {
  if (!references) return;
  if (references.get(id) !== name) throw new Error('Invalid API response: ' + label + ' reference');
};

export const knownPerson = (
  references: PersonReferences | undefined,
  id: string,
  name: string,
  role: (typeof MEMBER_ROLES)[number],
  lifecycle: (typeof MEMBER_LIFECYCLES)[number],
  label: string,
) => {
  if (!references) return;
  const reference = references.get(id);
  if (!reference || reference.name !== name || reference.role !== role || reference.lifecycle !== lifecycle) {
    throw new Error('Invalid API response: ' + label + ' reference');
  }
};

export const knownEventPerson = (references: PersonReferences | undefined, id: string, name: string) => {
  if (!references) return;
  const reference = references.get(id);
  if (!reference || reference.name !== name) throw new Error('Invalid API response: event actor reference');
};

export const knownTool = (references: ToolReferences | undefined, id: string, name: string, label = 'event tool') => {
  if (!references) return;
  if (references.get(id) !== name) throw new Error('Invalid API response: ' + label + ' reference');
};

export const parsePeopleReferences = (value: unknown, label: string) =>
  personReferences(arrayValue<AdminPersonReferenceDto>(value, label));

export const parseToolReferences = (value: unknown, label: string) =>
  toolReferences(arrayValue<AdminToolReferenceDto>(value, label));
