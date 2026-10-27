import { Wrench } from 'lucide-react';
import type { Model } from './client';
type Asset = Model<'AssetView'>;
export function AssetPhoto({
  asset,
  companyId,
  large = false,
}: {
  asset: Pick<Asset, 'registration_photo_id'>;
  companyId: string;
  large?: boolean;
}) {
  return asset.registration_photo_id ? (
    <span className={large ? 'catalog-photo-frame' : 'tool-photo'}>
      <img
        className={large ? 'catalog-photo' : ''}
        src={`/api/companies/${companyId}/files/${asset.registration_photo_id}`}
        alt=""
        loading="lazy"
      />
    </span>
  ) : (
    <span className={large ? 'catalog-placeholder' : 'tool-photo'}>
      <Wrench size={large ? 42 : 22} aria-hidden="true" />
    </span>
  );
}
