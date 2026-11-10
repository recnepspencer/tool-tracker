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
  'with-you': 'With you',
  'checked-out': 'Checked out',
  damaged: 'Damaged',
  lost: 'Lost',
  retired: 'Retired',
};

/** Worker-row copy from the demo's tool list. */
export const workerStatusLabel: Record<StatusTone, string> = {
  'in-stock': 'Available',
  'with-you': 'With you',
  'checked-out': 'In use',
  damaged: 'Damaged',
  lost: 'Lost',
  retired: 'Retired',
};

export const assetLabel = (asset: Asset & Pick<Model<'AssetView'>, 'lifecycle'>) =>
  asset.lifecycle === 'disposed' ? 'Disposed' : statusLabel[toolStatus(asset)];

/**
 * The status as the viewer reads it: what they can take, what they already hold, and what
 * someone else has. A tool the viewer holds reads "With you", never the same "Checked out" as a
 * coworker's.
 */
export function viewerStatus(
  asset: Asset & Pick<Model<'AssetView'>, 'lifecycle'>,
  membershipId: string,
): { tone: StatusTone; label: string } {
  const tone = toolStatus(asset);
  if (asset.lifecycle === 'disposed') return { tone, label: 'Disposed' };
  if (tone === 'checked-out' && asset.holder_membership_id === membershipId)
    return { tone: 'with-you', label: 'With you' };
  return { tone, label: tone === 'in-stock' ? 'Available' : statusLabel[tone] };
}

/** Registration photo URL, or null so ToolPhoto shows its placeholder. */
export const photoSrc = (companyId: string, photoId: string | null | undefined) =>
  photoId ? `/api/companies/${companyId}/files/${photoId}` : null;
