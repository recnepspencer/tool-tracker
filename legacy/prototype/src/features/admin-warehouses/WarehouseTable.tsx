import { Button } from '../../components/ui/Button';
import type { AdminWarehouseView } from '../../domain/read-models/admin';
import { MEMBER_ROLE_LABELS } from '../../domain/people';

export function WarehouseTable({
  warehouses,
  onOpen,
}: {
  warehouses: AdminWarehouseView[];
  onOpen(warehouse: AdminWarehouseView): void;
}) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table admin-table--responsive directory-table warehouses-table">
        <thead>
          <tr>
            <th>Warehouse</th>
            <th>Manager</th>
            <th>Status</th>
            <th>Custody</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {warehouses.map((warehouse) => (
            <tr key={warehouse.id}>
              <td data-label="Warehouse">
                <button className="admin-record-button" type="button" onClick={() => onOpen(warehouse)}>
                  {warehouse.name}
                </button>
                <span>{warehouse.address}</span>
                <span className="warehouses-table__mobile-meta">
                  {warehouse.manager} · {warehouse.tools} in stock · {warehouse.out} checked out
                </span>
              </td>
              <td className="directory-table__mobile-hide" data-label="Manager">
                {warehouse.manager}
                <span>{MEMBER_ROLE_LABELS[warehouse.managerRole]}</span>
              </td>
              <td className="directory-table__status" data-label="Status">
                <span className="lifecycle-pill lifecycle-pill--active">Active</span>
              </td>
              <td className="directory-table__mobile-hide" data-label="Custody">
                {warehouse.tools} in stock
                <span>{warehouse.out} checked out</span>
              </td>
              <td className="directory-table__actions" data-label="Actions">
                <Button variant="ghost" onClick={() => onOpen(warehouse)}>
                  Open
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
