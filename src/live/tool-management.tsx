import { Link } from 'react-router-dom';
import { api, type Model } from './client';
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
        <Section title="Record service">
          {t.lifecycle === 'disposed' ? (
            <Notice>This tool is permanently disposed.</Notice>
          ) : (
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
          )}
        </Section>
        <Section title="Retire or restore">
          {t.lifecycle === 'disposed' ? (
            <Notice>Disposal is permanent. This tool cannot be restored.</Notice>
          ) : t.missing ? (
            <Notice>Resolve the missing-tool report before changing its lifecycle.</Notice>
          ) : !t.warehouse_id ? (
            <Notice>Receive this tool at a warehouse before changing its lifecycle.</Notice>
          ) : (
            <Form
              label="Update lifecycle"
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
              <Select name="lifecycle" label="Lifecycle" defaultValue="">
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
        {c.can('tools.manage') && (
          <>
            <Section title="Asset information">
              <p className="muted">
                Serial numbers identify this unit. Shared model changes apply to every unit of that model.
              </p>
              <Link to="/app/catalog">Edit shared model in catalog</Link>
              <Form
                label="Update serial number"
                submit={(f) =>
                  api.POST('/api/companies/{company_id}/tools/{asset_id}/update', {
                    params: { path },
                    body: { expected_revision: t.revision, serial_number: text(f, 'serial') || null },
                  })
                }
              >
                <Field name="serial" label="Serial number" defaultValue={t.serial_number ?? ''} maxLength={120} />
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
