import { Link } from 'react-router-dom';
import { api, type Model } from './client';
import { AssetDetailsFields, assetDetailsInput } from './asset-details';
import { PhotoField } from './photos';
import { useStagedPhoto } from './photo-state';
import type { useToolDetailState } from './tools-state';
import { Field, Form, Notice, Section, Select, text } from './ui';
type Props = { state: ReturnType<typeof useToolDetailState>; asset: Model<'AssetView'> };
export function ToolManagement({ state, asset: t }: Props) {
  const { c, refs, path } = state;
  const photo = useStagedPhoto(c.company_id, 'service', t.revision);
  return (
    <>
      <div className="detail-grid">
        {t.lifecycle !== 'disposed' && (
          <>
            <Section title="Record service">
              <Form
                label="Save service record"
                onDone={photo.clear}
                submit={async (f) =>
                  api.POST('/api/companies/{company_id}/tools/{asset_id}/service', {
                    params: { path },
                    body: {
                      expected_revision: t.revision,
                      serviceability: text(f, 'condition') as 'serviceable' | 'damaged' | 'out_of_service',
                      note: text(f, 'note'),
                      photo_id: await photo.upload(f),
                    },
                  })
                }
              >
                <Select name="condition" label="Condition">
                  <option value="serviceable">Serviceable</option>
                  <option value="damaged">Damaged</option>
                  <option value="out_of_service">Out of service</option>
                </Select>
                <Field label="Work performed" name="note" required maxLength={2000} />
                <PhotoField />
              </Form>
            </Section>
            <Section title="Retirement & disposal">
              {t.missing ? (
                <Notice>Resolve the missing-tool report before retiring or disposing of it.</Notice>
              ) : !t.warehouse_id ? (
                <Notice>Receive this tool at a warehouse before retiring or disposing of it.</Notice>
              ) : t.pending_handoff_id ? (
                <Notice>Resolve the pending handoff in the queue before retiring or disposing of this tool.</Notice>
              ) : (
                <Form
                  label="Update status"
                  submit={(f) =>
                    api.POST('/api/companies/{company_id}/tools/{asset_id}/lifecycle', {
                      params: { path },
                      body: {
                        expected_revision: t.revision,
                        lifecycle: text(f, 'lifecycle') as 'active' | 'retired' | 'disposed',
                        note: text(f, 'note'),
                      },
                    })
                  }
                >
                  <Select name="lifecycle" label="Inventory status" defaultValue="">
                    <option value="">Choose a new lifecycle</option>
                    <option value="active" disabled={t.lifecycle === 'active'}>
                      Active
                    </option>
                    <option value="retired" disabled={t.lifecycle === 'retired'}>
                      Retired
                    </option>
                    <option value="disposed">Disposed (permanent)</option>
                  </Select>
                  <Field label="Reason" name="note" required maxLength={2000} />
                </Form>
              )}
            </Section>
          </>
        )}
        {c.can('tools.manage') && (
          <>
            <Section title="Asset information">
              <p className="muted">Changes apply to this tool only.</p>
              <Link to="/app/catalog">Edit shared model in catalog</Link>
              <Form
                label="Save tool details"
                submit={(f) =>
                  api.POST('/api/companies/{company_id}/tools/{asset_id}/update', {
                    params: { path },
                    body: { expected_revision: t.revision, ...assetDetailsInput(f) },
                  })
                }
              >
                <AssetDetailsFields asset={t} />
              </Form>
            </Section>
            <Section title="Warehouse responsibility">
              <Form
                label="Change responsible warehouse"
                submit={(f) =>
                  api.POST('/api/companies/{company_id}/tools/{asset_id}/stewardship', {
                    params: { path },
                    body: {
                      expected_revision: t.revision,
                      warehouse_id: text(f, 'warehouse'),
                      note: text(f, 'note'),
                    },
                  })
                }
              >
                <Select name="warehouse" label="Responsible warehouse" defaultValue={t.responsible_warehouse_id}>
                  {refs.warehouses.data?.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </Select>
                <Field name="note" label="Reason" required maxLength={2000} />
              </Form>
            </Section>
          </>
        )}
      </div>
    </>
  );
}
export function ToolReconciliation({ state }: Props) {
  const { path } = state;
  return (
    <Section title="Open a reconciliation case">
      <Form
        label="Open case"
        submit={(f) =>
          api.POST('/api/companies/{company_id}/tools/{asset_id}/reconciliations', {
            params: { path },
            body: {
              kind: text(f, 'kind') as 'custody_dispute' | 'missing_asset' | 'duplicate_asset',
              narrative: text(f, 'narrative'),
            },
          })
        }
      >
        <Select name="kind" label="Case type">
          <option value="custody_dispute">Custody dispute</option>
          <option value="missing_asset">Missing asset</option>
          <option value="duplicate_asset">Duplicate asset</option>
        </Select>
        <Field name="narrative" label="Describe the discrepancy" required maxLength={4000} />
      </Form>
      <Link to="/app/reconciliations">View open cases</Link>
    </Section>
  );
}
