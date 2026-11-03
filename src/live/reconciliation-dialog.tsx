import { api, type Model } from './client';
import { OverlayDialog, SelectField } from './kit';
import { caseKindLabels } from './reconciliation-state';
import { CustodyEvidenceFields } from './photos';
import { useStagedPhoto } from './photo-state';
import { useCompany } from './session';
import { Form, text } from './ui';

/** Resolve one reconciliation case with a reasoned note and, optionally, corrected custody. */
export function ResolveCaseDialog({
  item,
  asset,
  people,
  warehouses,
  onClose,
}: {
  item: Model<'ReconciliationView'>;
  asset: Model<'AssetView'>;
  people: Model<'MemberView'>[];
  warehouses: Model<'WarehouseView'>[];
  onClose(): void;
}) {
  const c = useCompany();
  const photo = useStagedPhoto(c.company_id, 'reconciliation', item.revision);
  return (
    <OverlayDialog
      label={`Resolve ${asset.name}`}
      onClose={onClose}
      panelClassName="admin-dialog operations-dialog"
      showCloseButton
    >
      <div className="dialog-heading">
        <span className="eyebrow">{caseKindLabels[item.kind]}</span>
        <h2>{asset.name}</h2>
        <p>
          {asset.asset_tag} · {asset.holder_name ?? asset.warehouse_name ?? 'No current custodian'}
        </p>
        {item.narrative && <p className="queue-item__note">“{item.narrative}”</p>}
      </div>
      <Form
        label="Resolve case"
        successMessage={null}
        onDone={() => {
          photo.clear();
          onClose();
        }}
        submit={async (f) => {
          const [kind, id] = text(f, 'destination').split(':');
          await api.POST('/api/companies/{company_id}/reconciliations/{case_id}/resolve', {
            params: { path: { ...c.path, case_id: item.id } },
            body: {
              expected_revision: item.revision,
              expected_asset_revision: asset.revision,
              note: text(f, 'note'),
              destination_membership_id: kind === 'person' ? id : null,
              destination_warehouse_id: kind === 'warehouse' ? id : null,
              photo_id: await photo.upload(f),
            },
          });
        }}
      >
        <SelectField
          name="destination"
          label="Correct custody"
          hint="A photo is required when custody changes"
          defaultValue=""
          options={[
            { value: '', label: 'Keep current custody' },
            ...people.map((person) => ({
              value: `person:${person.id}`,
              label: person.preferred_name,
              description: 'Person',
            })),
            ...warehouses.map((warehouse) => ({
              value: `warehouse:${warehouse.id}`,
              label: warehouse.name,
              description: 'Warehouse',
            })),
          ]}
        />
        <CustodyEvidenceFields
          context="review"
          noteName="note"
          noteLabel="Findings and resolution"
          notePlaceholder="What you found and how custody was settled"
          noteRequired
        />
      </Form>
    </OverlayDialog>
  );
}
