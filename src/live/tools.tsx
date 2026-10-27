import { Link } from 'react-router-dom';
import { errorMessage } from './client';
import { ToolHistory, ToolReports } from './tool-history';
import { AssetPhoto } from './asset-photo';
import { purchasePrice } from './asset-details';
import { useToolDetailState } from './tools-state';
import { ToolReport, ToolRequest, ToolTransfer } from './tool-actions';
import { ToolManagement, ToolReconciliation } from './tool-management';
import { Badge, date, human, Loading, Notice, Section } from './ui';

export function ToolDetail() {
  const state = useToolDetailState();
  const { c, tool, incidents, requests, action, setAction } = state;
  if (tool.isPending) return <Loading />;
  if (tool.error) return <Notice error>{errorMessage(tool.error)}</Notice>;
  const t = tool.data;
  const manages = c.can('tools.manage') || c.managed_warehouse_ids.includes(t.responsible_warehouse_id);
  const canHandoff =
    t.warehouse_id !== null && (c.can('tools.manage') || c.managed_warehouse_ids.includes(t.warehouse_id));
  const holds = t.holder_membership_id === c.membership_id;
  const transfer = (holds || canHandoff) && t.lifecycle === 'active' && !t.missing;
  const report = (holds || manages) && t.lifecycle === 'active';
  const damageOpen = incidents.data?.some((incident) => incident.kind === 'damage' && !incident.resolved_at);
  const missingOpen = incidents.data?.some((incident) => incident.kind === 'missing' && !incident.resolved_at);
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
      {t.lifecycle === 'disposed' && <Notice>Disposal is permanent. This tool cannot be restored.</Notice>}
      {action ? (
        <button className="text-button" onClick={() => setAction('')}>
          ← Back to tool
        </button>
      ) : (
        <section className="detail-actions" aria-label="Tool actions">
          {c.can('tools.request') && (t.requestable || !!requests.data?.length) && (
            <button className="primary" disabled={tool.isFetching} onClick={() => setAction('request')}>
              {requests.data?.length ? 'Your request' : 'Request this tool'}
            </button>
          )}
          {transfer && !t.pending_handoff_id && (
            <button className="primary" disabled={tool.isFetching} onClick={() => setAction('transfer')}>
              Transfer tool
            </button>
          )}
          {report && (
            <div className="detail-action-row">
              {!damageOpen && (
                <button
                  disabled={tool.isFetching || incidents.isPending || incidents.isFetching}
                  onClick={() => setAction('damage')}
                >
                  Report damaged
                </button>
              )}
              {!missingOpen && (
                <button
                  disabled={tool.isFetching || incidents.isPending || incidents.isFetching}
                  onClick={() => setAction('missing')}
                >
                  Report lost
                </button>
              )}
            </div>
          )}
          {manages && (t.lifecycle !== 'disposed' || c.can('tools.manage')) && (
            <button disabled={tool.isFetching} onClick={() => setAction('manage')}>
              Manage this tool
            </button>
          )}
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
        (report && (action === 'damage' ? damageOpen : missingOpen) ? (
          <Notice>This problem is already reported. View the open report below.</Notice>
        ) : report && incidents.isPending ? (
          <Loading />
        ) : report ? (
          <ToolReport state={state} asset={t} />
        ) : (
          <Notice>Only the holder or responsible manager may report this tool.</Notice>
        ))}
      {action === 'manage' &&
        (manages ? (
          (t.lifecycle !== 'disposed' || c.can('tools.manage')) && <ToolManagement state={state} asset={t} />
        ) : (
          <Notice>You do not manage this tool.</Notice>
        ))}
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
            <dt>Purchase price</dt>
            <dd>{purchasePrice(t)}</dd>
          </div>
          <div>
            <dt>Purchase date</dt>
            <dd>{t.acquisition_date || 'Not recorded'}</dd>
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
            <dd>{t.custody_started_at ? date(t.custody_started_at) : 'Not applicable'}</dd>
          </div>
        </dl>
        {t.notes && <p className="asset-notes">{t.notes}</p>}
        {t.registration_photo_id && (
          <a href={`/api/companies/${c.company_id}/files/${t.registration_photo_id}`}>Download registration photo</a>
        )}
      </Section>
      <ToolReports state={state} manages={manages} />
      <ToolHistory state={state} />
    </div>
  );
}
