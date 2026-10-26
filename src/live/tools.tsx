import { Link } from 'react-router-dom';
import { api, errorMessage } from './client';
import { AssetPhoto } from './asset-photo';
import { useToolDetailState } from './tools-state';
import { ToolReport, ToolRequest, ToolTransfer } from './tool-actions';
import { ToolManagement, ToolReconciliation } from './tool-management';
import { Badge, date, Empty, Field, Form, human, Loading, Notice, Section, text } from './ui';

export function ToolDetail() {
  const state = useToolDetailState();
  const { c, tool, history, incidents, service, requests, action, setAction } = state;
  if (tool.isPending) return <Loading />;
  if (tool.error) return <Notice error>{errorMessage(tool.error)}</Notice>;
  const t = tool.data;
  const manages = c.can('tools.manage') || c.managed_warehouse_ids.includes(t.responsible_warehouse_id);
  const canHandoff =
    t.warehouse_id !== null && (c.can('tools.manage') || c.managed_warehouse_ids.includes(t.warehouse_id));
  const holds = t.holder_membership_id === c.membership_id;
  const transfer = (holds || canHandoff) && t.lifecycle === 'active' && !t.missing;
  const report = (holds || manages) && t.lifecycle === 'active';
  return (
    <div className="tool-detail-content">
      <header className="detail-hero">
        <AssetPhoto asset={t} companyId={c.company_id} large />
        <div>
          <span className="eyebrow">{t.asset_tag}</span>
          <h1>{t.name}</h1>
          <p>
            {t.manufacturer} · {t.model_number}
          </p>
          <div className="detail-statuses">
            <Badge>{human(t.lifecycle)}</Badge>
            <Badge>{human(t.serviceability)}</Badge>
            {t.missing && <Badge>Missing</Badge>}
          </div>
        </div>
      </header>
      {action ? (
        <button className="text-button" onClick={() => setAction('')}>
          ← Back to tool
        </button>
      ) : (
        <section className="detail-actions" aria-label="Tool actions">
          {c.can('tools.request') && (t.requestable || !!requests.data?.length) && (
            <button className="primary" onClick={() => setAction('request')}>
              {requests.data?.length ? 'Your request' : 'Request this tool'}
            </button>
          )}
          {transfer && !t.pending_handoff_id && (
            <button className="primary" onClick={() => setAction('transfer')}>
              Transfer tool
            </button>
          )}
          {report && (
            <div className="detail-action-row">
              <button onClick={() => setAction('damage')}>Report damaged</button>
              <button onClick={() => setAction('missing')}>Report lost</button>
            </div>
          )}
          {manages && <button onClick={() => setAction('manage')}>Manage this tool</button>}
          {c.can('reconciliation.manage') && (
            <button onClick={() => setAction('reconcile')}>Open a reconciliation case</button>
          )}
        </section>
      )}
      {t.pending_handoff_id && (
        <Notice>
          A handoff is pending. Custody stays with the current holder until receipt is accepted.{' '}
          <Link to="/app/operations">Open queue</Link>
        </Notice>
      )}
      {action === 'request' && <ToolRequest state={state} asset={t} />}
      {action === 'transfer' &&
        (transfer ? (
          <ToolTransfer state={state} asset={t} />
        ) : (
          <Notice>You must be the holder or managing the source warehouse to propose this handoff.</Notice>
        ))}
      {(action === 'damage' || action === 'missing') &&
        (report ? (
          <ToolReport state={state} asset={t} />
        ) : (
          <Notice>Only the holder or responsible manager may report this tool.</Notice>
        ))}
      {action === 'manage' &&
        (manages ? <ToolManagement state={state} asset={t} /> : <Notice>You do not manage this tool.</Notice>)}
      {action === 'reconcile' && c.can('reconciliation.manage') && <ToolReconciliation state={state} asset={t} />}
      <Section title="Current custody">
        <p className="large-value">{t.holder_name ?? t.warehouse_name ?? 'No current custodian'}</p>
        {t.holder_ended_at ? (
          <p className="muted">Former employee · accountability retained until receipt or an evidenced correction.</p>
        ) : (
          t.holder_access_state &&
          t.holder_access_state !== 'active' && (
            <p className="muted">Access {t.holder_access_state} · custody retained.</p>
          )
        )}
        <dl className="detail-facts">
          <div>
            <dt>Unit</dt>
            <dd>{t.asset_tag}</dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd>{t.category_name}</dd>
          </div>
          <div>
            <dt>Origin warehouse</dt>
            <dd>{t.origin_warehouse_name}</dd>
          </div>
          <div>
            <dt>Responsible warehouse</dt>
            <dd>{t.responsible_warehouse_name}</dd>
          </div>
          <div>
            <dt>Serial</dt>
            <dd>{t.serial_number || 'Not recorded'}</dd>
          </div>
          <div>
            <dt>Condition</dt>
            <dd>
              {human(t.serviceability)}
              {t.missing && ' · Missing'}
            </dd>
          </div>
          <div>
            <dt>Last moved</dt>
            <dd>{date(t.custody_started_at)}</dd>
          </div>
        </dl>
        {t.registration_photo_id && (
          <a href={`/api/companies/${c.company_id}/files/${t.registration_photo_id}`}>Download registration photo</a>
        )}
      </Section>
      <Section title="Open reports">
        {incidents.error && <Notice error>{errorMessage(incidents.error)}</Notice>}
        {incidents.data?.map((incident) => (
          <article className="row" key={incident.id}>
            <div>
              <strong>{human(incident.kind)}</strong>
              <p>{incident.description}</p>
              <small>{date(incident.reported_at)}</small>
            </div>
            {manages && incident.kind === 'missing' && (
              <Form
                label="Mark found"
                submit={(f) =>
                  api.POST('/api/companies/{company_id}/incidents/{incident_id}/found', {
                    params: { path: { ...c.path, incident_id: incident.id } },
                    body: { expected_revision: incident.revision, note: text(f, 'note') },
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
      <Section title="Custody history">
        {history.error && <Notice error>{errorMessage(history.error)}</Notice>}
        {history.data?.map((period) => (
          <div className="row" key={period.id}>
            <strong>{period.holder_name}</strong>
            <span>
              {date(period.starts_at)} → {date(period.ends_at)}
            </span>
          </div>
        ))}
      </Section>
      <Section title="Service history">
        {service.error && <Notice error>{errorMessage(service.error)}</Notice>}
        {service.data?.map((event) => (
          <div className="row" key={event.id}>
            <div>
              <strong>{human(event.resulting_serviceability)}</strong>
              <p>{event.note}</p>
            </div>
            <span>{date(event.occurred_at)}</span>
          </div>
        ))}
        {service.data?.length === 0 && <Empty>No service records.</Empty>}
      </Section>
    </div>
  );
}
