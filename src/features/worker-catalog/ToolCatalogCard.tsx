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
  return (
    <article className={`catalog-card catalog-card--${mode}`}>
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
        <span className="catalog-unit-actions" aria-label={`${item.name} available units`}>
          {availableUnits.length ? (
            <button
              type="button"
              className="catalog-unit-button"
              onClick={() =>
                onSelect(
                  availableUnits[0].id,
                  'request',
                  availableUnits.map((unit) => ({
                    unitId: unit.id,
                    warehouseId: unit.warehouseId,
                    warehouseName:
                      item.warehouses.find((warehouse) => warehouse.id === unit.warehouseId)?.name ?? unit.warehouseId,
                  })),
                )
              }
              aria-label={`Check out ${item.name}`}
            >
              Check out
            </button>
          ) : (
            <span className="catalog-unit-empty">No units ready to check out</span>
          )}
        </span>
      </span>
    </article>
  );
}
