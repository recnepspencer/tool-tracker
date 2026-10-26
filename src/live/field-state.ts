import { useQueries, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, result, type Model } from './client';
import { collect, useReferences } from './data';
import { useListLocation } from './list-location';
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

export function useFieldTools() {
  const collection = useAssetCollection(true);
  const { c } = collection;
  const handoffs = useQuery({
    queryKey: [c.company_id, 'field-handoffs'],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/handoffs', {
            params: { path: c.path, query: { offset, pending: true } },
          })
          .then(result),
      ),
  });
  const pendingAssets = useQueries({
    queries: [...new Set(handoffs.data?.map((handoff) => handoff.asset_id) ?? [])].map((asset_id) => ({
      queryKey: [c.company_id, 'tool', asset_id],
      queryFn: () =>
        api
          .GET('/api/companies/{company_id}/tools/{asset_id}', { params: { path: { ...c.path, asset_id } } })
          .then(result),
    })),
  });
  return {
    ...collection,
    handoffs,
    pendingAsset: (id: string) => pendingAssets.find((asset) => asset.data?.id === id)?.data,
  };
}

export function useInventoryView(flagged = false) {
  const collection = useAssetCollection();
  const { params, update } = useListLocation();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const search = params.get('search') ?? '';
  const warehouse = params.get('warehouse') ?? '';
  const category = params.get('category') ?? '';
  const availability = params.get('availability') ?? '';
  const tools = (collection.tools.data ?? []).filter(
    (tool) =>
      (!flagged || tool.missing || tool.serviceability !== 'serviceable') &&
      (!warehouse || tool.responsible_warehouse_id === warehouse) &&
      (!category || tool.category_id === category) &&
      (availability !== 'available' || tool.requestable) &&
      (availability !== 'held' || tool.holder_membership_id !== null) &&
      `${tool.asset_tag} ${tool.serial_number ?? ''} ${tool.name} ${tool.manufacturer} ${tool.model_number}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const groups = new Map<string, Model<'AssetView'>[]>();
  for (const tool of tools) groups.set(tool.tool_model_id, [...(groups.get(tool.tool_model_id) ?? []), tool]);
  return {
    ...collection,
    groups,
    search,
    warehouse,
    expanded,
    category,
    availability,
    categories: [...new Map(collection.tools.data?.map((tool) => [tool.category_id, tool.category_name])).entries()],
    setCategory: (value: string) => update('category', value),
    setAvailability: (value: string) => update('availability', value),
    setSearch: (value: string) => update('search', value),
    setWarehouse: (value: string) => update('warehouse', value),
    toggle: (id: string) =>
      setExpanded((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
  };
}

export function useCheckout() {
  const collection = useInventoryView();
  const { params, update } = useListLocation();
  const mode = params.get('view') === 'list' ? 'list' : 'grid';
  return { ...collection, mode, setMode: (value: string) => update('view', value) };
}

export function useSheetNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const root = location.pathname.startsWith('/app/mine')
    ? '/app/mine'
    : location.pathname.startsWith('/app/checkout')
      ? '/app/checkout'
      : '/app/tools';
  const returnTo =
    typeof location.state?.returnTo === 'string' && location.state.returnTo.startsWith('/app/')
      ? location.state.returnTo
      : root + location.search;
  return { root, close: () => navigate(returnTo, { replace: true }) };
}
