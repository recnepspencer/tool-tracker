import { api, errorMessage } from './client';
import { type JobsState } from './jobs-state';
import { Badge, date, Empty, Field, Form, human, Loading, Notice, Section, Select, text } from './ui';

export function JobRequests({ state }: { state: Pick<JobsState, 'c' | 'requests' | 'completed' | 'setCompleted'> }) {
  const { c, requests, completed, setCompleted } = state;
  if (!c.can('jobs.assign') && !completed && requests.data?.length === 0 && !requests.error)
    return (
      <button className="job-history-link" onClick={() => setCompleted(true)}>
        View participation history
      </button>
    );
  return (
    <Section title="Participation requests">
      <label className="check">
        <input type="checkbox" checked={completed} onChange={(event) => setCompleted(event.target.checked)} />
        Include completed participation
      </label>
      {requests.isPending && <Loading />}
      {requests.error && <Notice error>{errorMessage(requests.error)}</Notice>}
      {requests.data?.map((request) => (
        <article
          className="queue-card"
          key={request.id}
          aria-label={`${request.member_name} ${request.intent} ${request.job_name}`}
        >
          <div className="row">
            <strong>
              {request.member_name} · {human(request.intent)}
            </strong>
            <Badge>{human(request.status)}</Badge>
          </div>
          <p>
            {request.job_number} · {request.job_name} · {date(request.requested_at)}
          </p>
          {request.reason && <p>{request.reason}</p>}
          {request.decision_note && <p>{request.decision_note}</p>}
          {request.decided_by_name && (
            <small>
              Decided by {request.decided_by_name} · {date(request.decided_at)}
            </small>
          )}
          {request.approval_blocked_reason && (
            <Notice>{request.approval_blocked_reason} Reject or withdraw this request to close it.</Notice>
          )}
          {request.status === 'pending' &&
            (c.can('jobs.assign') || (c.can('jobs.participate') && request.membership_id === c.membership_id)) && (
              <Form
                label="Submit decision"
                submit={(form) =>
                  api.POST('/api/companies/{company_id}/job-participation-requests/{request_id}/{action}', {
                    params: {
                      path: {
                        ...c.path,
                        request_id: request.id,
                        action: text(form, 'action') as 'approve' | 'reject' | 'withdraw',
                      },
                    },
                    body: { expected_revision: request.revision, note: text(form, 'note') },
                  })
                }
              >
                <Select name="action" label="Decision">
                  {c.can('jobs.assign') && (
                    <>
                      {!request.approval_blocked_reason && <option value="approve">Approve</option>}
                      <option value="reject">Reject</option>
                    </>
                  )}
                  {c.can('jobs.participate') && request.membership_id === c.membership_id && (
                    <option value="withdraw">Withdraw</option>
                  )}
                </Select>
                <Field label="Note" name="note" maxLength={2000} />
              </Form>
            )}
        </article>
      ))}
      {requests.data?.length === 0 && (
        <Empty>{completed ? 'No participation history.' : 'No pending participation requests.'}</Empty>
      )}
    </Section>
  );
}
