import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, result, type Model } from './client';
import { collect, usePeople } from './data';
import { useListLocation } from './list-location';
import { useCompany } from './session';
import { useCommand } from './settings-command-state';

type Warehouse = Model<'WarehouseView'>;

export function useWarehouseDirectory() {
  const c = useCompany();
  const cache = useQueryClient();
  const { params, update } = useListLocation();
  const archived = params.get('archived') === 'true';
  const search = params.get('search') ?? '';
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const archive = useCommand();
  const warehouses = useQuery({
    queryKey: [c.company_id, 'warehouses', archived],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/warehouses', { params: { path: c.path, query: { offset, archived } } })
          .then(result),
      ),
  });
  // The inventory's asset collection supplies the demo's per-warehouse custody counts.
  const assets = useQuery({
    queryKey: [c.company_id, 'asset-collection', false],
    enabled: c.can('tools.read'),
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/tools', { params: { path: c.path, query: { offset, limit: 100 } } })
          .then(result),
      ),
  });
  const people = usePeople({ enabled: c.can('people.manage') });
  const term = search.trim().toLocaleLowerCase();
  const rows = (warehouses.data ?? []).filter(
    (warehouse) =>
      !term ||
      [warehouse.name, warehouse.code, warehouse.address, ...warehouse.managers.map((manager) => manager.name)].some(
        (value) => value.toLocaleLowerCase().includes(term),
      ),
  );
  const custody = (warehouseId: string) => {
    if (!assets.data) return null;
    const active = assets.data.filter((asset) => asset.lifecycle === 'active');
    return {
      stock: active.filter((asset) => asset.warehouse_id === warehouseId && !asset.holder_membership_id).length,
      out: active.filter((asset) => asset.responsible_warehouse_id === warehouseId && asset.holder_membership_id)
        .length,
    };
  };
  const select = (id: string) => {
    setConfirmingArchive(false);
    archive.reset();
    update('warehouse', id);
  };
  return {
    c,
    warehouses,
    assets,
    people,
    rows,
    custody,
    archived,
    setArchived: (value: boolean) => update('archived', value ? 'true' : ''),
    search,
    setSearch: (value: string) => update('search', value),
    selected: warehouses.data?.find((item) => item.id === params.get('warehouse')),
    creating: params.get('warehouse') === 'new',
    select,
    confirmingArchive,
    archive,
    startArchive: () => {
      archive.reset();
      setConfirmingArchive(true);
    },
    cancelArchive: () => setConfirmingArchive(false),
    setWarehouseArchived: (warehouse: Warehouse, value: boolean) =>
      void archive.run(
        () =>
          api.POST('/api/companies/{company_id}/warehouses/{warehouse_id}/update', {
            params: { path: { ...c.path, warehouse_id: warehouse.id } },
            body: {
              expected_revision: warehouse.revision,
              name: warehouse.name,
              address: warehouse.address,
              archived: value,
            },
          }),
        () => {
          setConfirmingArchive(false);
          update('warehouse', '');
        },
      ),
    refreshSession: () => void cache.invalidateQueries({ queryKey: ['session'] }),
  };
}
export type WarehouseDirectory = ReturnType<typeof useWarehouseDirectory>;

export function useAccessDirectory() {
  const c = useCompany();
  const access = useQuery({
    queryKey: [c.company_id, 'permissions'],
    queryFn: () => api.GET('/api/companies/{company_id}/permissions', { params: { path: c.path } }).then(result),
  });
  return { c, access };
}
