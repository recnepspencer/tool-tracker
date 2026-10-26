import { useSettingsPageState } from './settings-state';

import { api, errorMessage, type Model } from './client';
import { Link } from 'react-router-dom';

import { Field, Form, Notice, Section, Select, text } from './ui';

export function SettingsPage() {
  const { c, tools, jobs, company, refresh } = useSettingsPageState();
  return (
    <>
      <h1>Settings</h1>
      <div className="view-controls">
        {c.can('jobs.manage') && (
          <Link className="button" to="/app/jobs">
            Manage jobs
          </Link>
        )}
        {c.can('catalog.manage') && (
          <Link className="button" to="/app/catalog">
            Tool catalog & categories
          </Link>
        )}
      </div>
      <p className="muted">
        These rules apply to everyone in {c.company_name}. Managers retain their explicit permissions.
      </p>
      {company.error && <Notice error>{errorMessage(company.error)}</Notice>}
      {company.data && c.can('company.manage') && (
        <Section title="Company profile">
          <Form
            label="Save company"
            submit={async (f) => {
              await api.POST('/api/companies/{company_id}/update', {
                params: { path: c.path },
                body: {
                  expected_revision: company.data.revision,
                  name: text(f, 'name'),
                  address: text(f, 'address'),
                  timezone: text(f, 'timezone'),
                },
              });
              await refresh();
            }}
          >
            <Field label="Company name" name="name" defaultValue={company.data.name} required maxLength={200} />
            <Field label="Address" name="address" defaultValue={company.data.address} maxLength={2000} />
            <Field label="Timezone" name="timezone" defaultValue={company.data.timezone} required maxLength={64} />
          </Form>
        </Section>
      )}
      {tools.error && <Notice error>{errorMessage(tools.error)}</Notice>}
      {tools.data && (
        <Section title="Employee tool uploads">
          <Form
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
