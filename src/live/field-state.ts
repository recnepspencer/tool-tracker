import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, result } from './client';
import {
  catalogCategories,
  catalogItems,
  catalogTarget,
  catalogWarehouses,
  type CatalogItem,
} from './checkout-catalog';
import { collect, useReferences } from './data';
import { useListLocation } from './list-location';
import { usePendingMovements } from './pending-state';
import { useCompany } from './session';

export function useAssetCollection(mine = false) {
  const c = useCompany();
  const refs = useReferences();
  const tools = useQuery({
    queryKey: [c.company_id, 'asset-collection', mine],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/tools', {
            params: {
              path: c.path,
              query: { offset, limit: 100, ...(mine ? { holder_membership_id: c.membership_id } : {}) },
            },
          })
          .then(result),
      ),
  });
  return { c, refs, tools };
}

/** My tools: the worker's held units, their pending movements and the in-place review sheet. */
export function useMyTools() {
  const { c, tools } = useAssetCollection(true);
  const pending = usePendingMovements();
  const navigate = useNavigate();
  const transferStatus: 'ready' | 'checking' | 'unavailable' = pending.error
    ? 'unavailable'
    : pending.isPending
      ? 'checking'
      : 'ready';
  return {
    c,
    tools,
    pending,
    transferStatus,
    openTool: (id: string) => navigate(`/app/mine/${id}`),
    startTransfer: (id: string) => navigate(`/app/mine/${id}?action=transfer`),
  };
}

/**
 * Checkout catalog. Filters live in the URL: `availability=all` turns off the
 * demo's default "Available only"; `warehouse` and `category` hold ids.
 */
export function useCheckout() {
  const { c, tools } = useAssetCollection();
  const { params, update } = useListLocation({ background: true });
  const location = useLocation();
  const navigate = useNavigate();
  // The demo opens the filter sheet on arrival, but not over a deep-linked tool sheet.
  const [filtersOpen, setFiltersOpen] = useState(() => location.pathname.replace(/\/$/, '') === '/app/checkout');
  const filters = {
    search: params.get('search') ?? '',
    warehouse: params.get('warehouse') ?? '',
    category: params.get('category') ?? '',
    availableOnly: params.get('availability') !== 'all',
  };
  const all = tools.data ?? [];
  const mode: 'grid' | 'list' = params.get('view') === 'list' ? 'list' : 'grid';
  return {
    c,
    tools,
    items: catalogItems(all, filters, c.membership_id),
    warehouses: catalogWarehouses(all),
    categories: catalogCategories(all),
    filters,
    mode,
    filtersOpen,
    openFilters: () => setFiltersOpen(true),
    closeFilters: () => setFiltersOpen(false),
    setMode: (value: 'grid' | 'list') => update('view', value === 'list' ? 'list' : ''),
    setSearch: (value: string) => update('search', value),
    setWarehouse: (value: string) => update('warehouse', value),
    setCategory: (value: string) => update('category', value),
    toggleAvailable: () => update('availability', filters.availableOnly ? 'all' : ''),
    clearFilters: () => {
      for (const key of ['search', 'warehouse', 'category', 'availability']) update(key, '');
    },
    openItem: (item: CatalogItem) => {
      const { unit, requestUnits } = catalogTarget(item);
      // Like the demo, a card with a requestable unit opens straight into the request action.
      navigate(
        { pathname: `/app/checkout/${unit.id}`, search: requestUnits.length ? '?action=request' : '' },
        { state: { returnTo: location.pathname + location.search, requestUnits } },
      );
    },
  };
}
