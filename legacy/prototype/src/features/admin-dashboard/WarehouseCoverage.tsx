import type { AdminSummary } from '../../domain/read-models/admin';
import { SurfaceCard } from '../../components/ui/SurfaceCard';

export function WarehouseCoverage({ warehouses }: { warehouses: AdminSummary['warehouses'] }) {
  return (
    <SurfaceCard className="warehouse-card">
      <div className="card-heading">
        <div>
          <span className="eyebrow">Coverage</span>
          <h2>Across the yards</h2>
        </div>
        <span className="section-count">{warehouses.length} connected</span>
      </div>
      <div className="warehouse-list">
        {warehouses.length ? (
          warehouses.map((warehouse) => (
            <div className="warehouse-row" key={warehouse.id}>
              <div>
                <strong>{warehouse.name}</strong>
                <span>
                  {warehouse.address} · {warehouse.manager}
                </span>
              </div>
              <div className="warehouse-stats">
                <span>
                  <b>{warehouse.tools}</b> stock
                </span>
                <span>
                  <b>{warehouse.out}</b> out
                </span>
              </div>
            </div>
          ))
        ) : (
          <p className="admin-empty">No warehouse coverage is available.</p>
        )}
      </div>
    </SurfaceCard>
  );
}
