import type { CatalogItem } from './checkout-catalog';
import { ToolPhoto } from './kit';
import { photoSrc } from './tool-status';

/** The demo's `ToolCatalogCard`: one card per tool model with unit availability counts. */
export function ToolCatalogCard({
  item,
  companyId,
  mode,
  priority,
  onSelect,
}: {
  item: CatalogItem;
  companyId: string;
  mode: 'grid' | 'list';
  priority: boolean;
  onSelect(item: CatalogItem): void;
}) {
  const statusParts = [
    item.availableCount ? `${item.availableCount} available` : null,
    item.checkedOutCount ? `${item.checkedOutCount} checked out` : null,
    item.attentionCount ? `${item.attentionCount} needs attention` : null,
    item.lostCount ? `${item.lostCount} lost` : null,
  ].filter(Boolean);
  const status = statusParts.join(' · ') || 'No units';
  const hasOnlyAvailable = item.availableCount > 0 && statusParts.length === 1;
  const total = item.units.length;
  return (
    <article
      className={`catalog-card catalog-card--${mode}`}
      role="button"
      tabIndex={0}
      aria-label={`Open ${item.name}`}
      data-catalog-item-id={item.id}
      onClick={() => onSelect(item)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(item);
        }
      }}
    >
      <ToolPhoto
        src={photoSrc(companyId, item.photoId)}
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
            {total} {total === 1 ? 'unit' : 'units'}
          </span>
        </span>
      </span>
    </article>
  );
}
