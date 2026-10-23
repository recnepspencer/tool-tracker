import type { ReactNode } from 'react';
import { SearchField } from '../ui/TextField';
import './DirectoryToolbar.css';

interface DirectoryFilter<T extends string> {
  value: T;
  label: string;
}

export function DirectoryToolbar<T extends string>({
  searchLabel,
  searchPlaceholder,
  search,
  onSearchChange,
  filters = [],
  activeFilter,
  onFilterChange,
  filterLabel = 'Directory filter',
  trailing,
}: {
  searchLabel: string;
  searchPlaceholder: string;
  search: string;
  onSearchChange(value: string): void;
  filters?: readonly DirectoryFilter<T>[];
  activeFilter?: T;
  onFilterChange?(value: T): void;
  filterLabel?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="directory-toolbar">
      <SearchField
        compact
        label={searchLabel}
        placeholder={searchPlaceholder}
        value={search}
        onChange={onSearchChange}
      />
      {filters.length ? (
        <div className="directory-toolbar__filters" role="tablist" aria-label={filterLabel}>
          {filters.map((filter) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeFilter === filter.value}
              className={
                activeFilter === filter.value
                  ? 'directory-toolbar__filter directory-toolbar__filter--active'
                  : 'directory-toolbar__filter'
              }
              onClick={() => onFilterChange?.(filter.value)}
              key={filter.value}
            >
              {filter.label}
            </button>
          ))}
        </div>
      ) : null}
      {trailing ? <div className="directory-toolbar__trailing">{trailing}</div> : null}
    </div>
  );
}
