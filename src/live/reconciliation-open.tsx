import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Model } from './client';
import { useAssetCollection } from './field-state';
import { FieldGroup, OverlayDialog, SelectField } from './kit';
import { caseKindOptions, type CaseKind } from './reconciliation-state';
import { CommandForm } from './tool-detail-form';
import { TextArea, text } from './ui';
import './reconciliation.css';

type Asset = Model<'AssetView'>;

/** How the other record reads in the picker: enough to tell two units of one model apart. */
function otherRecordDescription(tool: Asset) {
  return [
    tool.serial_number ? `Serial ${tool.serial_number}` : 'No serial',
    tool.holder_name ?? tool.warehouse_name ?? 'No current custodian',
  ].join(' · ');
}

/**
 * Open a reconciliation case from a tool. A duplicate names the other record up front, so the case can
 * later be settled by merging the two.
 */
export function OpenCaseDialog({ asset, onClose }: { asset: Asset; onClose(): void }) {
  const { c, tools } = useAssetCollection();
  const [kind, setKind] = useState<CaseKind>('custody_dispute');
  const [duplicate, setDuplicate] = useState('');
  const duplicateKind = kind === 'duplicate_asset';
  // Same model first: that is where a double registration almost always is.
  const others = (tools.data ?? [])
    .filter((tool) => tool.id !== asset.id && tool.lifecycle !== 'disposed')
    .sort(
      (a, b) =>
        Number(b.tool_model_id === asset.tool_model_id) - Number(a.tool_model_id === asset.tool_model_id) ||
        a.name.localeCompare(b.name),
    )
    .map((tool) => ({ value: tool.id, label: tool.name, description: otherRecordDescription(tool) }));
  return (
    <OverlayDialog
      label={`Open a reconciliation case for ${asset.name}`}
      onClose={onClose}
      panelClassName="admin-dialog operations-dialog"
      showCloseButton
    >
      <div className="dialog-heading">
        <h2>Something’s wrong with {asset.name}</h2>
        <p>Open a case when the records don’t match reality. It stays open until someone settles it.</p>
      </div>
      <CommandForm
        label="Open reconciliation case"
        submitLabel="Open case"
        disabled={duplicateKind && !duplicate}
        onCancel={onClose}
        onDone={onClose}
        after={
          <Link className="text-link" to="/app/reconciliations">
            View open cases
          </Link>
        }
        submit={(form) =>
          api.POST('/api/companies/{company_id}/tools/{asset_id}/reconciliations', {
            params: { path: { ...c.path, asset_id: asset.id } },
            body: {
              // Read from the form: the command form keeps the submit from when editing began.
              kind: text(form, 'kind') as CaseKind,
              duplicate_of_id: text(form, 'kind') === 'duplicate_asset' ? text(form, 'duplicate_of_id') : null,
              narrative: text(form, 'narrative'),
            },
          })
        }
      >
        <div className="operations-form reconciliation-form">
          <FieldGroup>
            <SelectField
              label="What’s wrong?"
              name="kind"
              value={kind}
              onChange={(value) => {
                setKind(value as CaseKind);
                setDuplicate('');
              }}
              options={caseKindOptions}
              searchable={false}
              required
            />
            {duplicateKind && (
              <SelectField
                label="The other record"
                name="duplicate_of_id"
                value={duplicate}
                onChange={setDuplicate}
                options={others}
                placeholder={tools.isPending ? 'Loading tools…' : 'Search by name or serial'}
                emptyMessage="No other tools match"
                disabled={tools.isPending}
                searchable
                required
              />
            )}
          </FieldGroup>
          <TextArea
            label="Details"
            hint="optional"
            name="narrative"
            maxLength={4000}
            rows={3}
            placeholder={duplicateKind ? 'How you know they’re the same tool' : 'What you saw, and who you spoke to'}
          />
        </div>
      </CommandForm>
    </OverlayDialog>
  );
}
