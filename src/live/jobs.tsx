import { useJobCardState, useJobsPageState } from './jobs-state';

import { api, errorMessage, requestKey, type Model } from './client';

import { Badge, date, Empty, Field, Form, human, Loading, Notice, Section, Select, text } from './ui';

export function JobsPage() {
  const { c, refs, archived, setArchived, jobs, projects, requests } = useJobsPageState();
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">TEAM & WORK</span>
          <h1>Jobs</h1>
          <p>Assignments, responsibilities, and participation requests.</p>
        </div>
      </header>
      {c.can('jobs.manage') && (
        <details className="panel">
          <summary>Create a project or job</summary>
          <div className="detail-grid">
            <Section title="New project">
              <Form
                label="Create project"
                submit={(f) =>
                  api.POST('/api/companies/{company_id}/projects', {
                    params: { path: c.path },
                    body: { number: text(f, 'number'), name: text(f, 'name'), lifecycle: 'active' },
                  })
                }
              >
                <Field label="Project number" name="number" required maxLength={50} />
                <Field label="Project name" name="name" required maxLength={200} />
              </Form>
            </Section>
            <Section title="New job">
              <Form
                label="Create job"
                submit={(f) =>
                  api.POST('/api/companies/{company_id}/jobs', {
                    params: { path: c.path },
                    body: {
                      project_id: text(f, 'project'),
                      number: text(f, 'number'),
                      name: text(f, 'name'),
                      status: 'active',
                    },
                  })
                }
              >
                <Select name="project" label="Project">
                  <option value="">Choose a project</option>
                  {projects.data
                    ?.filter((p) => !['closed', 'cancelled'].includes(p.lifecycle))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.number} · {p.name}
                      </option>
                    ))}
                </Select>
                <Field label="Job number" name="number" required maxLength={50} />
                <Field label="Job name" name="name" required maxLength={200} />
              </Form>
            </Section>
          </div>
        </details>
      )}
      <label className="check">
        <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Show archived jobs
      </label>
      {jobs.isPending && <Loading />}
      {jobs.error && <Notice error>{errorMessage(jobs.error)}</Notice>}
      {jobs.data?.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
      {jobs.data?.length === 0 && <Empty>No jobs yet.</Empty>}
      <Section title="Participation requests">
        {requests.error && <Notice error>{errorMessage(requests.error)}</Notice>}
        {requests.data?.map((r) => (
          <article className="queue-card" key={r.id}>
            <strong>
              {refs.person(r.membership_id)} · {human(r.intent)}
            </strong>
            <p>
              {jobs.data?.find((j) => j.id === r.job_id)?.name ?? 'Archived job'} · {date(r.requested_at)}
            </p>
            {r.reason && <p>{r.reason}</p>}
            {(c.can('jobs.assign') || r.membership_id === c.membership_id) && (
              <Form
                label="Submit decision"
                submit={(f) =>
                  api.POST('/api/companies/{company_id}/job-participation-requests/{request_id}/{action}', {
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
                <Select label="Decision" name="action">
                  {c.can('jobs.assign') && (
                    <>
                      <option value="approve">Approve</option>
                      <option value="reject">Reject</option>
                    </>
                  )}
                  {r.membership_id === c.membership_id && <option value="withdraw">Withdraw</option>}
                </Select>
                <Field label="Note" name="note" maxLength={2000} />
              </Form>
            )}
          </article>
        ))}
        {requests.data?.length === 0 && <Empty>No pending participation requests.</Empty>}
      </Section>
      {c.can('jobs.manage') && (
        <details className="panel">
          <summary>Manage projects</summary>
          {projects.data?.map((p) => (
            <Section title={`${p.number} · ${p.name}`} key={p.id}>
              <Form
                label="Save project"
                submit={(f) =>
                  api.POST('/api/companies/{company_id}/projects/{project_id}/update', {
                    params: { path: { ...c.path, project_id: p.id } },
                    body: {
                      expected_revision: p.revision,
                      name: text(f, 'name'),
                      lifecycle: text(f, 'lifecycle') as Model<'ProjectView'>['lifecycle'],
                    },
                  })
                }
              >
                <Field label="Name" name="name" defaultValue={p.name} required maxLength={200} />
                <Select label="Status" name="lifecycle" defaultValue={p.lifecycle}>
                  {['prospective', 'active', 'closed', 'cancelled'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              </Form>
            </Section>
          ))}
        </details>
      )}
    </>
  );
}
function JobCard({ job: j }: { job: Model<'JobView'> }) {
  const { c, refs, history, setHistory, key, setKey, policy, assignments, own, mode } = useJobCardState({ job: j });
  return (
    <article className="panel">
      <div className="row">
        <div>
          <span className="eyebrow">{j.number}</span>
          <h2>{j.name}</h2>
        </div>
        <Badge>{human(j.status)}</Badge>
      </div>
      <label className="check">
        <input type="checkbox" checked={history} onChange={(e) => setHistory(e.target.checked)} /> Assignment history
      </label>
      {assignments.error && <Notice error>{errorMessage(assignments.error)}</Notice>}
      {assignments.data?.map((a) => (
        <div className="row" key={a.id}>
          <div>
            <strong>{refs.person(a.membership_id)}</strong>
            <p>
              {human(a.responsibility)} · {date(a.starts_at)} → {date(a.ends_at)}
            </p>
          </div>
          {c.can('jobs.assign') && !a.ends_at && (
            <Form
              label="End assignment"
              submit={(f) =>
                api.POST('/api/companies/{company_id}/assignments/{assignment_id}/end', {
                  params: { path: { ...c.path, assignment_id: a.id } },
                  body: { expected_revision: j.revision, note: text(f, 'note') },
                })
              }
            >
              <Field label="Reason" name="note" required maxLength={2000} />
            </Form>
          )}
        </div>
      ))}
      {!j.archived_at &&
        c.can('jobs.participate') &&
        assignments.data &&
        policy.data &&
        mode !== 'disabled' &&
        (own || ['active', 'planned'].includes(j.status)) && (
          <Form
            label={`${mode === 'approval_required' ? 'Request to ' : ''}${own ? 'Leave job' : 'Join job'}`}
            submit={async (f) => {
              await api.POST('/api/companies/{company_id}/jobs/{job_id}/participation', {
                params: { path: { ...c.path, job_id: j.id } },
                body: {
                  request_key: key,
                  intent: own ? 'leave' : 'join',
                  assignment_id: own?.id ?? null,
                  reason: text(f, 'reason'),
                },
              });
              setKey(requestKey());
            }}
          >
            <Field name="reason" label="Participation note" maxLength={2000} />
          </Form>
        )}
      {c.can('jobs.assign') && !j.archived_at && (
        <details>
          <summary>Assign a person</summary>
          <Form
            label="Save assignment"
            submit={(f) =>
              api.POST('/api/companies/{company_id}/jobs/{job_id}/assignments', {
                params: { path: { ...c.path, job_id: j.id } },
                body: {
                  expected_revision: j.revision,
                  membership_id: text(f, 'member'),
                  responsibility: text(f, 'responsibility') as 'crew' | 'foreman' | 'supervisor',
                  reason: text(f, 'reason'),
                },
              })
            }
          >
            <Select label="Person" name="member">
              <option value="">Choose a person</option>
              {refs.people.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.preferred_name}
                </option>
              ))}
            </Select>
            <Select label="Responsibility" name="responsibility">
              <option value="crew">Crew</option>
              <option value="foreman">Foreman</option>
              <option value="supervisor">Supervisor</option>
            </Select>
            <Field name="reason" label="Reason" required maxLength={2000} />
          </Form>
        </details>
      )}
      {c.can('jobs.manage') && (
        <details>
          <summary>Edit job</summary>
          <Form
            label="Save job"
            submit={(f) =>
              api.POST('/api/companies/{company_id}/jobs/{job_id}/update', {
                params: { path: { ...c.path, job_id: j.id } },
                body: {
                  expected_revision: j.revision,
                  name: text(f, 'name'),
                  status: text(f, 'status') as Model<'JobView'>['status'],
                  archived: f.get('archive') === 'on',
                },
              })
            }
          >
            <Field label="Job name" name="name" defaultValue={j.name} required maxLength={200} />
            <Select label="Status" name="status" defaultValue={j.status}>
              {['planned', 'active', 'on_hold', 'completed', 'cancelled'].map((s) => (
                <option key={s} value={s}>
                  {human(s)}
                </option>
              ))}
            </Select>
            <label className="check">
              <input type="checkbox" name="archive" defaultChecked={!!j.archived_at} /> Archive job and end current
              assignments
            </label>
          </Form>
        </details>
      )}
    </article>
  );
}
