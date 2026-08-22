import { useState } from 'react';
import { LoadingState, ErrorState } from '../../components/ui/AsyncState';
import { Button } from '../../components/ui/Button';
import { PageHeading } from '../../components/layout/PageHeading';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { useAdminWarehouses } from '../admin/use-admin-warehouses';
import { WarehouseDialog, type EditableWarehouse } from './WarehouseDialog';
import './admin-warehouses.css';

export function WarehousesPage() {
  const warehouses = useAdminWarehouses();
  const [editing, setEditing] = useState<EditableWarehouse | null | undefined>(undefined);
  if (warehouses.isPending) return <LoadingState label="Loading warehouses…" />;
  if (warehouses.isError || !warehouses.data)
    return (
      <ErrorState message="The warehouse directory could not be loaded." onRetry={() => void warehouses.refetch()} />
    );
  return (
    <div className="page-content">
      <PageHeading
        eyebrow="Admin view · Warehouses"
        title="Warehouses"
        description="Keep coverage, managers, and stock authority aligned across every yard."
      />
      <div className="admin-toolbar">
        <span className="section-count">{warehouses.data.length} connected</span>
        <Button onClick={() => setEditing(null)}>Add warehouse</Button>
      </div>
      <div className="warehouse-admin-grid">
        {warehouses.data.map((warehouse) => (
          <SurfaceCard key={warehouse.id} className="warehouse-admin-card">
            <div className="card-heading">
              <div>
                <div className="warehouse-admin-status">
                  <span className="lifecycle-pill lifecycle-pill--active">Active</span>
                </div>
                <h2>{warehouse.name}</h2>
              </div>
              <Button
                variant="ghost"
                onClick={() =>
                  setEditing({
                    id: warehouse.id,
                    name: warehouse.name,
                    address: warehouse.address,
                    managerId: warehouse.managerId,
                  })
                }
              >
                Edit
              </Button>
            </div>
            <p>{warehouse.address}</p>
            <p className="warehouse-admin-manager">Managed by {warehouse.manager} · accepts returns</p>
            <div className="warehouse-admin-stats">
              <span>
                <b>{warehouse.tools}</b> in stock
              </span>
              <span>
                <b>{warehouse.out}</b> checked out
              </span>
            </div>
            <span className="lifecycle-pill">
              {warehouse.managerRole === 'admin' ? 'Admin manager' : 'Warehouse manager'}
            </span>
          </SurfaceCard>
        ))}
      </div>
      {!warehouses.data.length && <p className="admin-empty">No warehouses are configured.</p>}
      {editing !== undefined && (
        <WarehouseDialog warehouse={editing ?? undefined} onClose={() => setEditing(undefined)} />
      )}
    </div>
  );
}
