import { useMemo, useState } from 'react';
import { LoadingState, ErrorState } from '../../components/ui/AsyncState';
import { Button } from '../../components/ui/Button';
import { PageHeading } from '../../components/layout/PageHeading';
import { DirectoryToolbar } from '../../components/layout/DirectoryToolbar';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { useAdminWarehouses } from '../admin/use-admin-warehouses';
import { WarehouseDialog, type EditableWarehouse } from './WarehouseDialog';
import { WarehouseTable } from './WarehouseTable';
import type { AdminWarehouseView } from '../../domain/read-models/admin';
import './admin-warehouses.css';

export function WarehousesPage() {
  const warehouses = useAdminWarehouses();
  const [editing, setEditing] = useState<EditableWarehouse | null | undefined>(undefined);
  const [search, setSearch] = useState('');
  const rows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return warehouses.data ?? [];
    return (warehouses.data ?? []).filter((warehouse) =>
      `${warehouse.name} ${warehouse.address} ${warehouse.manager}`.toLocaleLowerCase().includes(query),
    );
  }, [search, warehouses.data]);
  const openWarehouse = (warehouse: AdminWarehouseView) =>
    setEditing({
      id: warehouse.id,
      name: warehouse.name,
      address: warehouse.address,
      managerId: warehouse.managerId,
    });
  if (warehouses.isPending && !warehouses.data) return <LoadingState label="Loading warehouses…" />;
  if (!warehouses.data)
    return (
      <ErrorState message="The warehouse directory could not be loaded." onRetry={() => void warehouses.refetch()} />
    );
  return (
    <div className="page-content">
      <PageHeading
        eyebrow="Admin view · Warehouses"
        title="Warehouses"
        description="Manage custody locations and the people responsible for them."
        action={<Button onClick={() => setEditing(null)}>Add warehouse</Button>}
      />
      {warehouses.isError && (
        <ErrorState
          message="The warehouse directory could not be refreshed."
          onRetry={() => void warehouses.refetch()}
        />
      )}
      <DirectoryToolbar
        searchLabel="Search warehouses"
        searchPlaceholder="Search warehouses…"
        search={search}
        onSearchChange={setSearch}
      />
      <SurfaceCard className="admin-table-card">
        <WarehouseTable warehouses={rows} onOpen={openWarehouse} />
        {!rows.length && (
          <p className="admin-empty">
            {warehouses.data.length ? 'No warehouses match this search.' : 'No warehouses are configured.'}
          </p>
        )}
      </SurfaceCard>
      {editing !== undefined && (
        <WarehouseDialog warehouse={editing ?? undefined} onClose={() => setEditing(undefined)} />
      )}
    </div>
  );
}
