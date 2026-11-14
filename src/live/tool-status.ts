import type { Model } from './client';
import type { StatusTone } from './kit';

type Asset = Pick<Model<'AssetView'>, 'lifecycle' | 'missing' | 'serviceability' | 'holder_membership_id'>;

/**
 * The demo's single tool status. Lifecycle wins, then loss, then condition,
 * then custody, so a damaged tool someone is holding still reads as damaged.
 */
export function toolStatus(asset: Asset): StatusTone {
  if (asset.lifecycle !== 'active') return 'retired';
  if (asset.missing) return 'lost';
  if (asset.serviceability !== 'serviceable') return 'damaged';
  return asset.holder_membership_id ? 'checked-out' : 'in-stock';
}

/** Badge copy used in the control room and the tool sheet. */
export const statusLabel: Record<StatusTone, string> = {
  'in-stock': 'In stock',
  'checked-out': 'Checked out',
  damaged: 'Damaged',
  lost: 'Lost',
  retired: 'Retired',
};

/** Worker-row copy from the demo's tool list. */
export const workerStatusLabel: Record<StatusTone, string> = {
  'in-stock': 'Available',
  'checked-out': 'In use',
  damaged: 'Damaged',
  lost: 'Lost',
  retired: 'Retired',
};

export const assetLabel = (asset: Asset & Pick<Model<'AssetView'>, 'lifecycle'>) =>
  asset.lifecycle === 'disposed' ? 'Disposed' : statusLabel[toolStatus(asset)];

/**
 * Photo URL, or null so ToolPhoto shows its placeholder. Lists use the 320px
 * thumbnail, sheets the 1280px display copy; only "view photo" links fetch
 * the camera original. Field crews often browse on weak cellular signal.
 */
export type PhotoSize = 'thumb' | 'display' | 'original';
export const photoSrc = (companyId: string, photoId: string | null | undefined, size: PhotoSize = 'thumb') =>
  photoId ? `/api/companies/${companyId}/files/${photoId}${size === 'original' ? '' : `?size=${size}`}` : null;
