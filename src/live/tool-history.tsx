import { api, errorMessage, type Model } from './client';
import type { useToolDetailState } from './tools-state';
import { date, Empty, Field, Form, human, Loading, Notice, Section, text } from './ui';

type State = ReturnType<typeof useToolDetailState>;

function EvidenceLinks({ companyId, ids, label }: { companyId: string; ids: string[]; label: string }) {
  return ids.map((id, index) => (
    <a key={id} href={`/api/companies/${companyId}/files/${id}`}>
      Download {label} photo {index + 1}
    </a>
  ));
}

export function ToolReports({ state, manages }: { state: Pick<State, 'c' | 'incidents'>; manages: boolean }) {
  const { c, incidents } = state;
  const open = incidents.data?.filter((incident) => !incident.resolved_at) ?? [];
  const resolved = incidents.data?.filter((incident) => incident.resolved_at) ?? [];
  return (
    <Section title="Open reports">
      {incidents.isPending && <Loading />}
      {incidents.error && <Notice error>{errorMessage(incidents.error)}</Notice>}
      {open.map((incident) => (
        <article className="tool-history-entry" key={incident.id} aria-label={`${human(incident.kind)} report`}>
          <ReportRecord companyId={c.company_id} incident={incident} />
          {manages && incident.kind === 'missing' && (
            <Form
              label="Mark found"
              submit={(form) =>
                api.POST('/api/companies/{company_id}/incidents/{incident_id}/found', {
                  params: { path: { ...c.path, incident_id: incident.id } },
                  body: { expected_revision: incident.revision, note: text(form, 'note') },
                })
              }
            >
              <Field label="Where was it found?" name="note" required maxLength={2000} />
            </Form>
          )}
        </article>
      ))}
      {incidents.data && open.length === 0 && <Empty>No open reports.</Empty>}
      {resolved.length > 0 && (
        <details className="resolved-reports">
          <summary>Resolved reports ({resolved.length})</summary>
          {resolved.map((incident) => (
            <article
              className="tool-history-entry"
              key={incident.id}
              aria-label={`Resolved ${human(incident.kind)} report`}
            >
              <ReportRecord companyId={c.company_id} incident={incident} />
              <p>{incident.resolution_note}</p>
              <small>
                Resolved{incident.resolved_by_name ? ` by ${incident.resolved_by_name}` : ''} ·{' '}
                {date(incident.resolved_at)}
              </small>
            </article>
          ))}
        </details>
      )}
    </Section>
  );
}

function ReportRecord({ companyId, incident }: { companyId: string; incident: Model<'IncidentView'> }) {
  return (
    <>
      <strong>{human(incident.kind)}</strong>
      <p>{incident.description}</p>
      <small>
        Reported by {incident.reported_by_name} · {date(incident.reported_at)}
      </small>
      <EvidenceLinks companyId={companyId} ids={incident.photo_ids} label="report" />
    </>
  );
}

export function ToolHistory({ state }: { state: Pick<State, 'c' | 'history' | 'service' | 'lifecycle'> }) {
  const { c, history, service, lifecycle } = state;
  return (
    <>
      <Section title="Custody history">
        {history.isPending && <Loading />}
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
        {service.isPending && <Loading />}
        {service.error && <Notice error>{errorMessage(service.error)}</Notice>}
        {service.data?.map((event) => (
          <article className="tool-history-entry" key={event.id}>
            <strong>{human(event.resulting_serviceability)}</strong>
            <p>{event.note}</p>
            <small>
              Recorded by {event.performed_by_name} · {date(event.occurred_at)}
            </small>
            <EvidenceLinks companyId={c.company_id} ids={event.photo_ids} label="service" />
          </article>
        ))}
        {service.data?.length === 0 && <Empty>No service records.</Empty>}
      </Section>
      <Section title="Retirement & disposal history">
        {lifecycle.isPending && <Loading />}
        {lifecycle.error && <Notice error>{errorMessage(lifecycle.error)}</Notice>}
        {lifecycle.data?.map((event) => (
          <article className="tool-history-entry" key={event.id}>
            <strong>
              {human(event.from_lifecycle)} → {human(event.to_lifecycle)}
            </strong>
            <p>{event.reason}</p>
            <small>
              Changed by {event.actor_name} · {date(event.occurred_at)}
            </small>
          </article>
        ))}
        {lifecycle.data?.length === 0 && <Empty>No retirement or disposal records.</Empty>}
      </Section>
    </>
  );
}
