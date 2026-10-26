import { api, errorMessage, type Model } from './client';
import type { SettingsState } from './settings-state';
import { Field, Form, Loading, Notice, Section, Select, text } from './ui';

export function CompanyProfile({ state }: { state: Pick<SettingsState, 'c' | 'company' | 'refresh'> }) {
  const { c, company, refresh } = state;
  return (
    <Section title="Company profile">
      {company.isPending && <Loading />}
      {company.error && <Notice error>{errorMessage(company.error)}</Notice>}
      {company.data &&
        (c.can('company.manage') ? (
          <Form
            label="Save company"
            submit={async (form) => {
              await api.POST('/api/companies/{company_id}/update', {
                params: { path: c.path },
                body: {
                  expected_revision: company.data.revision,
                  name: text(form, 'name'),
                  address: text(form, 'address'),
                  timezone: text(form, 'timezone'),
                },
              });
              await refresh();
            }}
          >
            <Field label="Company name" name="name" defaultValue={company.data.name} required maxLength={200} />
            <Field label="Address" name="address" defaultValue={company.data.address} maxLength={2000} />
            <Field label="Timezone" name="timezone" defaultValue={company.data.timezone} required maxLength={64} />
          </Form>
        ) : (
          <dl className="detail-facts">
            <div>
              <dt>Company name</dt>
              <dd>{company.data.name}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>{company.data.address || 'Not recorded'}</dd>
            </div>
            <div>
              <dt>Timezone</dt>
              <dd>{company.data.timezone}</dd>
            </div>
          </dl>
        ))}
    </Section>
  );
}

export function RegistrationSettings({ state }: { state: Pick<SettingsState, 'c' | 'tools'> }) {
  const { c, tools } = state;
  if (!c.can('tools.register') && !c.can('tools.manage_registration_policy')) return null;
  return (
    <Section title="Employee tool uploads">
      {tools.isPending && <Loading />}
      {tools.error && <Notice error>{errorMessage(tools.error)}</Notice>}
      {tools.data &&
        (c.can('tools.manage_registration_policy') ? (
          <Form
            label="Save registration rule"
            submit={(form) =>
              api.POST('/api/companies/{company_id}/tool-registration-policy', {
                params: { path: c.path },
                body: {
                  expected_revision: tools.data.revision,
                  employee_tool_creation_enabled: text(form, 'enabled') === 'true',
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
        ) : (
          <p>
            {tools.data.employee_tool_creation_enabled
              ? 'Employees can register tools and upload photos.'
              : 'Equipment managers register tools and upload registration photos.'}
          </p>
        ))}
    </Section>
  );
}

const participationModes = {
  direct: 'Employees decide directly',
  approval_required: 'Manager approval required',
  disabled: 'Managers assign only',
};

export function ParticipationSettings({ state }: { state: Pick<SettingsState, 'c' | 'jobs'> }) {
  const { c, jobs } = state;
  return (
    <Section title="Job participation">
      {jobs.isPending && <Loading />}
      {jobs.error && <Notice error>{errorMessage(jobs.error)}</Notice>}
      {jobs.data &&
        (c.can('jobs.manage_policy') ? (
          <Form
            label="Save job rules"
            submit={(form) =>
              api.POST('/api/companies/{company_id}/job-participation-policy', {
                params: { path: c.path },
                body: {
                  expected_revision: jobs.data.revision,
                  self_join_mode: text(form, 'join') as Model<'ParticipationPolicyView'>['self_join_mode'],
                  self_leave_mode: text(form, 'leave') as Model<'ParticipationPolicyView'>['self_leave_mode'],
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
                {Object.entries(participationModes).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            ))}
          </Form>
        ) : (
          <dl className="detail-facts">
            <div>
              <dt>Employees joining jobs</dt>
              <dd>{participationModes[jobs.data.self_join_mode]}</dd>
            </div>
            <div>
              <dt>Employees leaving jobs</dt>
              <dd>{participationModes[jobs.data.self_leave_mode]}</dd>
            </div>
          </dl>
        ))}
    </Section>
  );
}
