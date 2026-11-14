import type { ReactNode } from 'react';
import type { Model } from './client';
import { formatDate, formatStamp } from './format';
import { purchasePrice } from './asset-details';
import { photoSrc } from './tool-status';
import './experience/tool-detail-live.css';
import { useCompany } from './session';

type Asset = Model<'AssetView'>;

export const conditionLabels: Record<Asset['serviceability'], string> = {
  serviceable: 'Serviceable',
  damaged: 'Damaged',
  out_of_service: 'Out of service',
};

export const lifecycleLabels: Record<Asset['lifecycle'], string> = {
  active: 'Active',
  retired: 'Retired',
  disposed: 'Disposed',
};

const accessLabels: Record<NonNullable<Asset['holder_access_state']>, string> = {
  active: '',
  suspended: 'Access suspended · custody retained',
  disabled: 'Access disabled · custody retained',
};

/** A calendar date from the API ("2026-03-14") read in local time, not UTC midnight. */
const calendarDate = (value: string) => formatDate(new Date(`${value}T00:00:00`));

export const custodianName = (t: Asset) => t.holder_name ?? t.warehouse_name ?? 'No current custodian';

/** Why the current holder may no longer be reachable, or null. */
export function custodyCaveat(t: Asset) {
  if (t.holder_ended_at) return 'Former employee · accountable until receipt or an evidenced correction';
  return t.holder_access_state ? accessLabels[t.holder_access_state] || null : null;
}

function Fact({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'tool-detail-fact--wide' : undefined}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** The demo's ToolMetadata rows plus the live purchase, stewardship and registration records. */
export function ToolFacts({
  asset: t,
  companyId,
  className,
  custody = true,
}: {
  asset: Asset;
  companyId: string;
  className: 'detail-facts' | 'inventory-drawer__facts';
  custody?: boolean;
}) {
  const sensitive = useCompany().can('tools.manage');
  const caveat = custodyCaveat(t);
  const photo = photoSrc(companyId, t.registration_photo_id, 'original');
  return (
    <dl className={className}>
      <Fact label="Category">{t.category_name}</Fact>
      {custody && (
        <Fact label="Custody">
          {custodianName(t)}
          {caveat && ` · ${caveat}`}
        </Fact>
      )}
      <Fact label="Origin warehouse">{t.origin_warehouse_name}</Fact>
      <Fact label="Responsible warehouse">{t.responsible_warehouse_name}</Fact>
      {sensitive && <Fact label="Serial">{t.serial_number || 'Not recorded'}</Fact>}
      <Fact label="Condition">
        {conditionLabels[t.serviceability]}
        {t.missing && ' · Missing'}
      </Fact>
      <Fact label="Lifecycle">{lifecycleLabels[t.lifecycle]}</Fact>
      <Fact label="Last moved">{t.custody_started_at ? formatStamp(t.custody_started_at) : 'Not recorded'}</Fact>
      {sensitive && <Fact label="Purchase price">{purchasePrice(t)}</Fact>}
      {sensitive && (
        <Fact label="Purchase date">{t.acquisition_date ? calendarDate(t.acquisition_date) : 'Not recorded'}</Fact>
      )}
      {photo && (
        <Fact label="Registration photo">
          <a className="text-button" href={photo} target="_blank" rel="noreferrer">
            View photo
          </a>
        </Fact>
      )}
      {t.notes && (
        <Fact label="Notes" wide>
          {t.notes}
        </Fact>
      )}
    </dl>
  );
}
