import type { ToolCatalogItem } from '../../domain/read-models/tools';
import { ToolPhoto } from '../../components/ui/ToolPhoto';
import type { DetailAction } from '../tool-detail/detail-action-types';
import type { CheckoutUnitOption } from '../tool-detail/checkout-unit-option';

export function ToolCatalogCard({
  item,
  mode,
  priority,
  onSelect,
}: {
  item: ToolCatalogItem;
  mode: 'grid' | 'list';
  priority: boolean;
  onSelect(toolUnitId: string, action?: DetailAction, requestUnits?: CheckoutUnitOption[]): void;
}) {
  const statusParts = [
    item.availableCount ? `${item.availableCount} available` : null,
    item.checkedOutCount ? `${item.checkedOutCount} checked out` : null,
    item.damagedCount ? `${item.damagedCount} needs attention` : null,
    item.lostCount ? `${item.lostCount} lost` : null,
  ].filter(Boolean);
  const status = statusParts.join(' · ') || 'No units';
  const hasOnlyAvailable = item.availableCount > 0 && statusParts.length === 1;
  const availableUnits = item.units.filter((unit) => unit.status === 'in-stock');
  const selectedUnit = availableUnits[0] ?? item.units[0];
  const openDetail = () => {
    if (!selectedUnit) return;
    onSelect(
      selectedUnit.id,
      availableUnits.length ? 'request' : undefined,
      availableUnits.length
        ? availableUnits.map((unit) => ({
            unitId: unit.id,
            warehouseId: unit.warehouseId,
            warehouseName:
              item.warehouses.find((warehouse) => warehouse.id === unit.warehouseId)?.name ?? unit.warehouseId,
          }))
        : undefined,
    );
  };
  return (
    <article
      className={`catalog-card catalog-card--${mode}`}
      role="button"
      tabIndex={0}
      aria-label={`Open ${item.name}`}
      data-catalog-item-id={item.id}
      onClick={openDetail}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openDetail();
        }
      }}
    >
      <ToolPhoto
        src={item.imageSrc}
        alt={`${item.name} product photo`}
        size={mode === 'grid' ? 'card' : 'small'}
        priority={priority}
      />
      <span className="catalog-card-body">
        <span className="catalog-card-title">
          <strong>{item.name}</strong>
          <span className={`catalog-availability ${hasOnlyAvailable ? 'catalog-availability--available' : ''}`}>
            {status}
          </span>
        </span>
        <span className="catalog-card-subtitle">
          {item.brand} · {item.model}
        </span>
        <span className="catalog-card-meta">
          <span>{item.category}</span>
          <span>
            {item.totalCount} {item.totalCount === 1 ? 'unit' : 'units'}
          </span>
        </span>
      </span>
    </article>
  );
}
