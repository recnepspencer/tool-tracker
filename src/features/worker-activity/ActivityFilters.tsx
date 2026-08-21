import type { ActivityFilter } from './activity-selectors';

const filters: Array<{ value: ActivityFilter; label: string }> = [
  { value: 'all', label: 'All activity' },
  { value: 'mine', label: 'Mine' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'damage', label: 'Damage & loss' },
];

export function ActivityFilters({ value, onChange }: { value: ActivityFilter; onChange(value: ActivityFilter): void }) {
  return (
    <div className="activity-filters" aria-label="Activity filters">
      {filters.map((filter) => (
        <button
          type="button"
          key={filter.value}
          className={value === filter.value ? 'activity-filter--active' : ''}
          aria-pressed={value === filter.value}
          onClick={() => onChange(filter.value)}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}
