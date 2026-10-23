import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, result, errorMessage, type Model } from './client';
import { useCompany } from './session';
import { collect } from './data';
import { Select, Form, Notice, Loading, Empty, Section, text, human, date } from './ui';

export function SettingsPage() {
  const c = useCompany();
  const tools = useQuery({
    queryKey: [c.company_id, 'registration-policy'],
    enabled: c.can('tools.manage_registration_policy'),
    queryFn: () =>
      api.GET('/api/companies/{company_id}/tool-registration-policy', { params: { path: c.path } }).then(result),
  });
  const jobs = useQuery({
    queryKey: [c.company_id, 'participation-policy'],
    enabled: c.can('jobs.manage_policy'),
    queryFn: () =>
      api.GET('/api/companies/{company_id}/job-participation-policy', { params: { path: c.path } }).then(result),
  });
  return (
    <>
      <h1>Company rules</h1>
      <p className="muted">
        These rules apply to everyone in {c.company_name}. Managers retain their explicit permissions.
      </p>
      {tools.error && <Notice error>{errorMessage(tools.error)}</Notice>}
      {tools.data && (
        <Section title="Employee tool uploads">
          <Form
            key={tools.data.revision}
            label="Save registration rule"
            submit={(f) =>
              api.POST('/api/companies/{company_id}/tool-registration-policy', {
                params: { path: c.path },
                body: {
                  expected_revision: tools.data.revision,
                  employee_tool_creation_enabled: text(f, 'enabled') === 'true',
                },
              })
            }
          >
            <Select
              label="Can employees register tools and upload registration photos?"
              name="enabled"
              defaultValue={String(tools.data.employee_tool_creation_enabled)}
            >
              <option value="true">Yes, employees and managers</option>
              <option value="false">No, managers only</option>
            </Select>
          </Form>
        </Section>
      )}
      {jobs.error && <Notice error>{errorMessage(jobs.error)}</Notice>}
      {jobs.data && (
        <Section title="Job participation">
          <Form
            key={jobs.data.revision}
            label="Save job rules"
            submit={(f) =>
              api.POST('/api/companies/{company_id}/job-participation-policy', {
                params: { path: c.path },
                body: {
                  expected_revision: jobs.data.revision,
                  self_join_mode: text(f, 'join') as Model<'ParticipationPolicyView'>['self_join_mode'],
                  self_leave_mode: text(f, 'leave') as Model<'ParticipationPolicyView'>['self_leave_mode'],
                },
              })
            }
          >
            {(['join', 'leave'] as const).map((intent) => (
              <Select
                key={intent}
                label={`Employees ${intent === 'join' ? 'joining' : 'leaving'} jobs`}
                name={intent}
                defaultValue={jobs.data[`self_${intent}_mode`]}
              >
                <option value="direct">Employees decide directly</option>
                <option value="approval_required">Manager approval required</option>
                <option value="disabled">Managers assign only</option>
              </Select>
            ))}
          </Form>
        </Section>
      )}
    </>
  );
}
export function ActivityPage() {
  const c = useCompany();
  const [offset, setOffset] = useState(0);
  const activity = useQuery({
    queryKey: [c.company_id, 'activity', offset],
    queryFn: () =>
      api
        .GET('/api/companies/{company_id}/activity', { params: { path: c.path, query: { offset, limit: 30 } } })
        .then(result),
  });
  return (
    <>
      <h1>Activity</h1>
      <p className="muted">
        {c.can('activity.read') ? 'Company activity' : 'Your activity'}. Recent changes to tools, custody, and team
        assignments.
      </p>
      {activity.isPending && <Loading />}
      {activity.error && <Notice error>{errorMessage(activity.error)}</Notice>}
      {activity.data?.items.map((a) => (
        <article className="panel" key={a.id}>
          <strong>{human(a.event_key)}</strong>
          <p>{date(a.occurred_at)}</p>
          {typeof a.metadata.reason === 'string' && <p>{a.metadata.reason}</p>}
        </article>
      ))}
      {activity.data?.items.length === 0 && <Empty>No activity yet.</Empty>}
      {activity.data && (
        <div className="pagination">
          <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 30))}>
            Previous
          </button>
          <button disabled={activity.data.next_offset === null} onClick={() => setOffset(activity.data.next_offset!)}>
            Next
          </button>
        </div>
      )}
    </>
  );
}
export function DirectoryPage() {
  const c = useCompany();
  const [search, setSearch] = useState('');
  const directory = useQuery({
    queryKey: [c.company_id, 'directory', search],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/directory', { params: { path: c.path, query: { offset, search } } })
          .then(result),
      ),
  });
  return (
    <>
      <h1>Team directory</h1>
      <label className="field">
        <span>Find a person, job, or held tool</span>
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      {directory.isPending && <Loading />}
      {directory.error && <Notice error>{errorMessage(directory.error)}</Notice>}
      {directory.data?.map((p) => (
        <article className="panel" key={p.membership_id}>
          <h2>{p.name}</h2>
          <p>
            {p.jobs.map((j) => `${j.number} ${j.name} (${human(j.responsibility)})`).join(' · ') || 'No current jobs'}
          </p>
          <p className="muted">
            {p.tools.map((t) => `${t.asset_tag} ${t.name}${t.missing ? ' — Missing' : ''}`).join(' · ') ||
              'No tools in custody'}
          </p>
        </article>
      ))}
    </>
  );
}
