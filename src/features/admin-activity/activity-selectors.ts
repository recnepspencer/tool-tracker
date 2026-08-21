import type { AuditEventView } from '../../domain/read-models/activity';

export type AuditKindFilter = 'all' | AuditEventView['kind'];

export const filterAuditEvents = (
  events: AuditEventView[],
  search: string,
  kind: AuditKindFilter,
  warehouseId: string,
) => {
  const query = search.trim().toLocaleLowerCase();
  return events.filter((event) => {
    const matchesSearch =
      !query ||
      [event.actor, event.action, event.toolName, event.toolUnitId, event.warehouseName]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase().includes(query));
    const matchesKind = kind === 'all' || event.kind === kind;
    const matchesWarehouse = warehouseId === 'all' || event.warehouseId === warehouseId;
    return matchesSearch && matchesKind && matchesWarehouse;
  });
};
