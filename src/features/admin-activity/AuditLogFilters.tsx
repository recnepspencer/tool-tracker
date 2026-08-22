import { useMemo } from 'react';
import { SelectField } from '../../components/ui/SelectField';
import { SearchField } from '../../components/ui/TextField';
import type { AuditEventView } from '../../domain/read-models/activity';
import type { AuditKindFilter } from './activity-selectors';

export function AuditLogFilters({
  events,
  search,
  kind,
  warehouseId,
  onSearchChange,
  onKindChange,
  onWarehouseChange,
}: {
  events: AuditEventView[];
  search: string;
  kind: AuditKindFilter;
  warehouseId: string;
  onSearchChange(value: string): void;
  onKindChange(value: AuditKindFilter): void;
  onWarehouseChange(value: string): void;
}) {
  const warehouses = useMemo(
    () => [
      ...new Map(
        events
          .filter((event) => event.warehouseId && event.warehouseName)
          .map((event) => [event.warehouseId!, event.warehouseName!]),
      ).entries(),
    ],
    [events],
  );
  return (
    <>
      <div className="activity-kind-chips" aria-label="Audit event type">
        {(
          [
            ['all', 'Everything'],
            ['custody', 'Custody'],
            ['request', 'Requests'],
            ['flag', 'Flags'],
            ['admin', 'Admin'],
          ] as const
        ).map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={kind === value ? 'activity-kind-chip activity-kind-chip--active' : 'activity-kind-chip'}
            aria-pressed={kind === value}
            onClick={() => onKindChange(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="activity-toolbar">
        <SearchField
          label="Search audit log"
          value={search}
          onChange={onSearchChange}
          placeholder="Search actor, tool, action…"
        />
        <SelectField
          compact
          label="Warehouse"
          value={warehouseId}
          onChange={onWarehouseChange}
          options={[
            { value: 'all', label: 'All warehouses' },
            ...warehouses.map(([value, label]) => ({ value, label })),
          ]}
        />
      </div>
    </>
  );
}
