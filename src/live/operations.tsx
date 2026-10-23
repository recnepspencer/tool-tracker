import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { api, result, errorMessage, type Model } from './client';
import { useCompany } from './session';
import { collect, useReferences } from './data';
import { Field, Select, Form, Notice, Loading, Empty, Section, Badge, text, human, date } from './ui';
import { PhotoField, uploadPhoto } from './tools';

export function OperationsPage() {
  const c = useCompany();
  const refs = useReferences();
  const [history, setHistory] = useState(false);
  const requests = useQuery({
    queryKey: [c.company_id, 'requests', history],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/tool-requests', {
            params: { path: c.path, query: { offset, pending: !history } },
          })
          .then(result),
      ),
  });
  const handoffs = useQuery({
    queryKey: [c.company_id, 'handoffs', history],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/handoffs', {
            params: { path: c.path, query: { offset, pending: !history } },
          })
          .then(result),
      ),
  });
  const ids = [...new Set([...(requests.data ?? []), ...(handoffs.data ?? [])].map((r) => r.asset_id))];
  const assets = useQueries({
    queries: ids.map((asset_id) => ({
      queryKey: [c.company_id, 'tool', asset_id],
      queryFn: () =>
        api
          .GET('/api/companies/{company_id}/tools/{asset_id}', { params: { path: { ...c.path, asset_id } } })
          .then(result),
    })),
  });
  const asset = (id: string) => assets.find((a) => a.data?.id === id)?.data;
  const authority = (warehouse: string | null | undefined) =>
    !!warehouse && (c.can('tools.manage') || c.managed_warehouse_ids.includes(warehouse));
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">CUSTODY</span>
          <h1>Requests & handoffs</h1>
          <p>Approve requests, confirm receipt, and keep custody current.</p>
        </div>
      </header>
      <label className="check">
        <input type="checkbox" checked={history} onChange={(e) => setHistory(e.target.checked)} /> Include completed
        history
      </label>
      <Section title="Tool requests">
        {requests.isPending && <Loading />}
        {requests.error && <Notice error>{errorMessage(requests.error)}</Notice>}
        {requests.data?.length === 0 && <Empty>No requests to review.</Empty>}
        {requests.data?.map((r) => (
          <article className="queue-card" key={r.id}>
            <div className="row">
              <div>
                <Link to={`/app/tools/${r.asset_id}`}>
                  <strong>
                    {asset(r.asset_id)?.asset_tag ?? 'Tool'} · {asset(r.asset_id)?.name ?? 'View tool'}
                  </strong>
                </Link>
                <p>Requested by {refs.person(r.requester_id)}</p>
                <small>{date(r.requested_at)}</small>
              </div>
              <Badge>{human(r.status)}</Badge>
            </div>
            {r.note && <p>{r.note}</p>}
            {['pending', 'approved'].includes(r.status) &&
              (r.requester_id === c.membership_id || authority(asset(r.asset_id)?.warehouse_id)) && (
                <Form
                  label="Apply decision"
                  submit={(f) =>
                    api.POST('/api/companies/{company_id}/tool-requests/{request_id}/{action}', {
                      params: {
                        path: {
                          ...c.path,
                          request_id: r.id,
                          action: text(f, 'action') as 'approve' | 'reject' | 'withdraw',
                        },
                      },
                      body: { expected_revision: r.revision, note: text(f, 'note') },
                    })
                  }
                >
                  <Select name="action" label="Decision">
                    {authority(asset(r.asset_id)?.warehouse_id) && r.status === 'pending' && (
                      <option value="approve">Approve and prepare handoff</option>
                    )}
                    {authority(asset(r.asset_id)?.warehouse_id) && <option value="reject">Reject</option>}
                    {r.requester_id === c.membership_id && <option value="withdraw">Withdraw my request</option>}
                  </Select>
                  <Field label="Decision note" name="note" maxLength={2000} />
                </Form>
              )}
          </article>
        ))}
      </Section>
      <Section title="Handoffs">
        {handoffs.isPending && <Loading />}
        {handoffs.error && <Notice error>{errorMessage(handoffs.error)}</Notice>}
        {handoffs.data?.length === 0 && <Empty>No handoffs to review.</Empty>}
        {handoffs.data?.map((h) => {
          const receiving = h.destination_membership_id === c.membership_id || authority(h.destination_warehouse_id);
          const cancelling = h.proposed_by_id === c.membership_id;
          return (
            <article className="queue-card" key={h.id}>
              <div className="row">
                <div>
                  <Link to={`/app/tools/${h.asset_id}`}>
                    <strong>
                      {asset(h.asset_id)?.asset_tag ?? 'Tool'} · {asset(h.asset_id)?.name ?? 'View tool'}
                    </strong>
                  </Link>
                  <p>
                    To{' '}
                    {h.destination_membership_id
                      ? refs.person(h.destination_membership_id)
                      : refs.warehouse(h.destination_warehouse_id)}
                  </p>
                  <small>
                    Proposed by {refs.person(h.proposed_by_id)} · {date(h.proposed_at)}
                  </small>
                </div>
                <Badge>{human(h.status)}</Badge>
              </div>
              {h.note && <p>{h.note}</p>}
              {h.status === 'pending' && (receiving || cancelling) && (
                <Form
                  label="Confirm handoff decision"
                  submit={(f) =>
                    api.POST('/api/companies/{company_id}/handoffs/{handoff_id}/{action}', {
                      params: {
                        path: {
                          ...c.path,
                          handoff_id: h.id,
                          action: text(f, 'action') as 'accept' | 'decline' | 'cancel',
                        },
                      },
                      body: { expected_revision: h.revision, note: text(f, 'note') },
                    })
                  }
                >
                  <Select label="Decision" name="action">
                    {receiving && (
                      <>
                        <option value="accept">Accept — I have received this tool</option>
                        <option value="decline">Decline receipt</option>
                      </>
                    )}
                    {cancelling && <option value="cancel">Cancel my handoff</option>}
                  </Select>
                  <Field label="Note" name="note" maxLength={2000} />
                </Form>
              )}
            </article>
          );
        })}
      </Section>
    </>
  );
}

function ResolveCase({ item }: { item: Model<'ReconciliationView'> }) {
  const c = useCompany();
  const refs = useReferences();
  const asset = useQuery({
    queryKey: [c.company_id, 'tool', item.asset_id],
    queryFn: () =>
      api
        .GET('/api/companies/{company_id}/tools/{asset_id}', {
          params: { path: { ...c.path, asset_id: item.asset_id } },
        })
        .then(result),
  });
  return (
    <article className="queue-card">
      <Link to={`/app/tools/${item.asset_id}`}>
        <strong>
          {asset.data?.asset_tag ?? 'View tool'} · {human(item.kind)}
        </strong>
      </Link>
      <p>{item.narrative}</p>
      <small>{date(item.opened_at)}</small>
      {asset.error && <Notice error>{errorMessage(asset.error)}</Notice>}
      {asset.data && (
        <Form
          label="Resolve case"
          submit={async (f) => {
            const destination = text(f, 'destination').split(':');
            await api.POST('/api/companies/{company_id}/reconciliations/{case_id}/resolve', {
              params: { path: { ...c.path, case_id: item.id } },
              body: {
                expected_revision: item.revision,
                expected_asset_revision: asset.data.revision,
                note: text(f, 'note'),
                destination_membership_id: destination[0] === 'person' ? destination[1] : null,
                destination_warehouse_id: destination[0] === 'warehouse' ? destination[1] : null,
                photo_id: await uploadPhoto(c.company_id, f, 'reconciliation'),
              },
            });
          }}
        >
          <Field name="note" label="Findings and resolution" required maxLength={2000} />
          <Select label="Correct custody (photo required if changed)" name="destination" required={false}>
            <option value="">Keep current custody</option>
            {refs.people.data?.map((p) => (
              <option key={p.id} value={`person:${p.id}`}>
                {p.preferred_name}
              </option>
            ))}
            {refs.warehouses.data?.map((w) => (
              <option key={w.id} value={`warehouse:${w.id}`}>
                {w.name}
              </option>
            ))}
          </Select>
          <PhotoField />
        </Form>
      )}
    </article>
  );
}
export function ReconciliationsPage() {
  const c = useCompany();
  const cases = useQuery({
    queryKey: [c.company_id, 'cases'],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/reconciliations', { params: { path: c.path, query: { offset } } })
          .then(result),
      ),
  });
  return (
    <>
      <h1>Reconciliation</h1>
      <p className="muted">Resolve discrepancies with a reasoned record. Open a case from an individual tool.</p>
      {cases.isPending && <Loading />}
      {cases.error && <Notice error>{errorMessage(cases.error)}</Notice>}
      {cases.data?.map((item) => (
        <ResolveCase key={item.id} item={item} />
      ))}
      {cases.data?.length === 0 && <Empty>No open cases.</Empty>}
    </>
  );
}
