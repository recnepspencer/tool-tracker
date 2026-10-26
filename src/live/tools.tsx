import { PhotoField, uploadPhoto } from './photos';
import { useRegisterToolState, useToolDetailState } from './tools-state';

import { Link } from 'react-router-dom';

import { api, errorMessage, result } from './client';

import { Badge, date, Empty, Field, Form, human, Loading, Notice, Section, Select, text } from './ui';

export function RegisterTool() {
  const { c, refs, key, created, setCreated, policy } = useRegisterToolState();
  if (policy.isPending) return <Loading />;
  if (policy.error) return <Notice error>{errorMessage(policy.error)}</Notice>;
  if (!c.can('tools.manage') && !policy.data.employee_tool_creation_enabled)
    return <Notice>Employee tool registration is disabled by your company. Contact your equipment manager.</Notice>;
  return (
    <>
      <Link to="/app/tools">← Tools</Link>
      <h1>Register a physical tool</h1>
      <p className="muted">Choose the shared model, then identify this individual tool.</p>
      {created ? (
        <Notice>
          Tool registered. <Link to={`/app/tools/${created}`}>Open its custody record</Link>
        </Notice>
      ) : (
        <Section title="Tool details">
          <Form
            label="Register tool"
            submit={async (f) => {
              const photo_id = await uploadPhoto(c.company_id, f, 'registration');
              const tool = result(
                await api.POST('/api/companies/{company_id}/tools', {
                  params: { path: c.path },
                  body: {
                    request_key: key,
                    tool_model_id: text(f, 'model'),
                    warehouse_id: text(f, 'warehouse'),
                    asset_tag: text(f, 'tag'),
                    serial_number: text(f, 'serial') || null,
                    photo_id,
                  },
                }),
              );
              setCreated(tool.id);
            }}
          >
            <Select label="Tool model" name="model">
              <option value="">Choose a model</option>
              {refs.models.data?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.manufacturer} {m.name} · {m.model_number}
                </option>
              ))}
            </Select>
            <Select label="Starting warehouse" name="warehouse">
              <option value="">Choose a warehouse</option>
              {refs.warehouses.data?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
            <Field label="Unique asset tag" name="tag" required maxLength={64} />
            <Field label="Serial number" name="serial" maxLength={120} />
            <PhotoField />
          </Form>
          {c.can('catalog.manage') && (
            <Link className="text-link" to="/app/catalog">
              Manage models and warehouses
            </Link>
          )}
        </Section>
      )}
    </>
  );
}
export function ToolDetail() {
  const { c, refs, path, key, renewKey, tool, history, incidents, service } = useToolDetailState();
  if (tool.isPending) return <Loading />;
  if (tool.error) return <Notice error>{errorMessage(tool.error)}</Notice>;
  const t = tool.data;
  const manages = c.can('tools.manage') || c.managed_warehouse_ids.includes(t.responsible_warehouse_id);
  const canHandoff =
    c.can('tools.manage') || (t.warehouse_id !== null && c.managed_warehouse_ids.includes(t.warehouse_id));
  const holds = t.holder_membership_id === c.membership_id;
  return (
    <>
      <Link to="/app/tools">← Tools</Link>
      <header className="page-heading">
        <div>
          <span className="eyebrow">{t.asset_tag}</span>
          <h1>{t.name}</h1>
          <p>
            {t.manufacturer} · {t.model_number} · Serial {t.serial_number || 'not recorded'}
          </p>
        </div>
        <Badge>{t.missing ? 'Missing' : human(t.lifecycle)}</Badge>
      </header>
      <div className="detail-grid">
        <Section title="Current custody">
          <p className="large-value">
            {t.holder_membership_id
              ? refs.person(t.holder_membership_id)
              : t.warehouse_id
                ? refs.warehouse(t.warehouse_id)
                : 'No current custodian'}
          </p>
          <p>
            {human(t.serviceability)}
            {t.missing && ' · Missing'}
          </p>
          <p className="muted">Responsible warehouse: {refs.warehouse(t.responsible_warehouse_id)}</p>
          {t.registration_photo_id && (
            <a href={`/api/companies/${c.company_id}/files/${t.registration_photo_id}`}>Download registration photo</a>
          )}
        </Section>
        {t.requestable && c.can('tools.request') && (
          <Section title="Request this tool">
            <Form
              label="Request tool"
              onDone={renewKey}
              submit={(f) =>
                api.POST('/api/companies/{company_id}/tools/{asset_id}/requests', {
                  params: { path },
                  body: { request_key: key, note: text(f, 'note') },
                })
              }
            >
              <Field label="Note (optional)" name="note" maxLength={2000} />
            </Form>
            <p className="muted">
              Your request identifies {t.asset_tag}. Custody changes when the handoff is accepted.
            </p>
          </Section>
        )}
        {(holds || canHandoff) && t.lifecycle === 'active' && (
          <Section title="Transfer or return">
            <Form
              label="Propose handoff"
              onDone={renewKey}
              submit={async (f) => {
                const dest = text(f, 'destination').split(':');
                await api.POST('/api/companies/{company_id}/tools/{asset_id}/handoffs', {
                  params: { path },
                  body: {
                    request_key: key,
                    expected_revision: t.revision,
                    destination_membership_id: dest[0] === 'person' ? dest[1] : null,
                    destination_warehouse_id: dest[0] === 'warehouse' ? dest[1] : null,
                    note: text(f, 'note'),
                    photo_id: await uploadPhoto(c.company_id, f, 'handoff'),
                  },
                });
              }}
            >
              <Select label="Send to" name="destination">
                <option value="">Choose a person or warehouse</option>
                <optgroup label="People">
                  {refs.people.data
                    ?.filter((p) => p.id !== t.holder_membership_id)
                    .map((p) => (
                      <option value={`person:${p.id}`} key={p.id}>
                        {p.preferred_name}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Warehouses">
                  {refs.warehouses.data
                    ?.filter((w) => w.id !== t.warehouse_id)
                    .map((w) => (
                      <option value={`warehouse:${w.id}`} key={w.id}>
                        {w.name}
                      </option>
                    ))}
                </optgroup>
              </Select>
              <Field name="note" label="Handoff note" maxLength={2000} />
              <PhotoField />
            </Form>
          </Section>
        )}
        {(holds || manages) && t.lifecycle === 'active' && (
          <Section title="Report a problem">
            <Form
              label="Submit report"
              submit={async (f) =>
                api.POST('/api/companies/{company_id}/tools/{asset_id}/incidents', {
                  params: { path },
                  body: {
                    expected_revision: t.revision,
                    kind: text(f, 'kind') as 'damage' | 'missing',
                    description: text(f, 'description'),
                    photo_id: await uploadPhoto(c.company_id, f, 'incident'),
                  },
                })
              }
            >
              <Select label="Problem" name="kind">
                <option value="damage">Damaged</option>
                <option value="missing">Missing</option>
              </Select>
              <Field name="description" label="What happened?" required maxLength={2000} />
              <PhotoField />
            </Form>
          </Section>
        )}
      </div>
      <Section title="Open reports">
        {incidents.error && <Notice error>{errorMessage(incidents.error)}</Notice>}
        {incidents.data?.map((i) => (
          <article className="row" key={i.id}>
            <div>
              <strong>{human(i.kind)}</strong>
              <p>{i.description}</p>
              <small>{date(i.reported_at)}</small>
            </div>
            {manages && i.kind === 'missing' && (
              <Form
                label="Mark found"
                submit={(f) =>
                  api.POST('/api/companies/{company_id}/incidents/{incident_id}/found', {
                    params: { path: { ...c.path, incident_id: i.id } },
                    body: { expected_revision: i.revision, note: text(f, 'note') },
                  })
                }
              >
                <Field label="Where was it found?" name="note" required maxLength={2000} />
              </Form>
            )}
          </article>
        ))}
        {incidents.data?.length === 0 && <Empty>No open reports.</Empty>}
      </Section>
      {manages && (
        <details className="panel">
          <summary>Manage this tool</summary>
          <div className="detail-grid">
            <Section title="Record service">
              <Form
                label="Save service record"
                submit={async (f) =>
                  api.POST('/api/companies/{company_id}/tools/{asset_id}/service', {
                    params: { path },
                    body: {
                      expected_revision: t.revision,
                      serviceability: text(f, 'condition') as 'serviceable' | 'damaged' | 'out_of_service',
                      note: text(f, 'note'),
                      photo_id: await uploadPhoto(c.company_id, f, 'service'),
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
            <Section title="Retire or restore">
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
                <Select name="lifecycle" label="Lifecycle" defaultValue={t.lifecycle}>
                  <option value="active">Active</option>
                  <option value="retired">Retired</option>
                  <option value="disposed">Disposed (permanent)</option>
                </Select>
                <Field label="Reason" name="note" required maxLength={2000} />
              </Form>
            </Section>
            {c.can('tools.manage') && (
              <>
                <Section title="Asset information">
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
        </details>
      )}
      {c.can('reconciliation.manage') && (
        <details className="panel">
          <summary>Open a reconciliation case</summary>
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
        </details>
      )}
      <Section title="Custody history">
        {history.error && <Notice error>{errorMessage(history.error)}</Notice>}
        {history.data?.map((h) => (
          <div className="row" key={h.id}>
            <strong>
              {h.holder_membership_id ? refs.person(h.holder_membership_id) : refs.warehouse(h.holder_warehouse_id)}
            </strong>
            <span>
              {date(h.starts_at)} → {date(h.ends_at)}
            </span>
          </div>
        ))}
      </Section>
      <Section title="Service history">
        {service.error && <Notice error>{errorMessage(service.error)}</Notice>}
        {service.data?.map((s) => (
          <div className="row" key={s.id}>
            <div>
              <strong>{human(s.resulting_serviceability)}</strong>
              <p>{s.note}</p>
            </div>
            <span>{date(s.occurred_at)}</span>
          </div>
        ))}
        {service.data?.length === 0 && <Empty>No service records.</Empty>}
      </Section>
    </>
  );
}
