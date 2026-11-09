import { saveLogo } from './auth-state';
import { LogoField } from './auth-ui';
import { api, type Model } from './client';
import { ErrorState, LoadingState, SelectField, Switch } from './kit';
import { useCompany, useSession } from './session';
import { CommandError, CommandForm, SettingsCard } from './settings-command';
import { useCommand } from './settings-command-state';
import type { SettingsState } from './settings-state';
import { Field, text } from './ui';

type ParticipationMode = Model<'ParticipationPolicyView'>['self_join_mode'];

const PARTICIPATION_LABELS: Record<ParticipationMode, string> = {
  direct: 'Employees decide directly',
  approval_required: 'Manager approval required',
  disabled: 'Managers assign only',
};
const PARTICIPATION_OPTIONS = (Object.keys(PARTICIPATION_LABELS) as ParticipationMode[]).map((value) => ({
  value,
  label: PARTICIPATION_LABELS[value],
}));

function timezoneOptions(current: string) {
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  return [...new Set([current, ...zones])]
    .filter(Boolean)
    .map((zone) => ({ value: zone, label: zone.replaceAll('_', ' ') }));
}

export function CompanyProfile({ state }: { state: Pick<SettingsState, 'c' | 'company' | 'refresh'> }) {
  const { c, company, refresh } = state;
  return (
    <SettingsCard title="Company profile" description="How your company appears to everyone in this workspace.">
      {company.isError && (
        <ErrorState message="Company details could not be refreshed." onRetry={() => void company.refetch()} />
      )}
      {company.data &&
        (c.can('company.manage') ? (
          <CommandForm
            className=""
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
            <div className="settings-fields">
              <Field label="Company name" name="name" defaultValue={company.data.name} required maxLength={200} />
              <Field label="Address" name="address" defaultValue={company.data.address} maxLength={2000} />
              <SelectField
                label="Timezone"
                name="timezone"
                required
                defaultValue={company.data.timezone}
                placeholder="Choose a timezone"
                options={timezoneOptions(company.data.timezone)}
              />
            </div>
            <CompanyLogo logoId={company.data.logo_id} />
          </CommandForm>
        ) : (
          <div className="admin-detail-list">
            <div>
              <strong>Company name</strong>
              <span>{company.data.name}</span>
            </div>
            <div>
              <strong>Address</strong>
              <span>{company.data.address || 'Not recorded'}</span>
            </div>
            <div>
              <strong>Timezone</strong>
              <span>{company.data.timezone.replaceAll('_', ' ')}</span>
            </div>
          </div>
        ))}
    </SettingsCard>
  );
}

/** Saved as soon as it is chosen or removed, apart from the profile's revisioned fields. */
function CompanyLogo({ logoId }: { logoId?: string | null }) {
  const c = useCompany();
  const command = useCommand();
  const session = useSession();
  return (
    <div className="settings-fields">
      <LogoField
        value={{ id: logoId }}
        onChange={(choice) =>
          void command.run(
            async () => {
              const logo_id = await saveLogo(choice);
              await api.POST('/api/companies/{company_id}/logo', { params: { path: c.path }, body: { logo_id } });
            },
            () => void session.refresh(),
          )
        }
      />
      <CommandError error={command.error} />
    </div>
  );
}

export function RegistrationSettings({
  state,
}: {
  state: Pick<SettingsState, 'c' | 'tools' | 'registration' | 'setRegistration'>;
}) {
  const { c, tools, registration } = state;
  if (!c.can('tools.register') && !c.can('tools.manage_registration_policy')) return null;
  const enabled = tools.data?.employee_tool_creation_enabled ?? false;
  return (
    <SettingsCard title="Employee tool uploads" description="Who can add tools to the inventory.">
      {tools.isPending && <LoadingState label="Loading upload rule…" />}
      {tools.isError && (
        <ErrorState message="The upload rule could not be loaded." onRetry={() => void tools.refetch()} />
      )}
      {tools.data &&
        (c.can('tools.manage_registration_policy') ? (
          <>
            <Switch
              label="Employees can register tools"
              description="When off, only equipment managers register tools and upload registration photos."
              checked={registration.busy ? !enabled : enabled}
              disabled={registration.busy || tools.isFetching}
              onCheckedChange={state.setRegistration}
            />
            <CommandError error={registration.error} />
          </>
        ) : (
          <p className="settings-muted">
            {enabled
              ? 'Employees can register tools and upload photos.'
              : 'Equipment managers register tools and upload registration photos.'}
          </p>
        ))}
    </SettingsCard>
  );
}

export function ParticipationSettings({ state }: { state: Pick<SettingsState, 'c' | 'jobs'> }) {
  const { c, jobs } = state;
  return (
    <SettingsCard title="Job participation" description="Whether employees can join or leave jobs on their own.">
      {jobs.isPending && <LoadingState label="Loading job rules…" />}
      {jobs.isError && <ErrorState message="Job rules could not be loaded." onRetry={() => void jobs.refetch()} />}
      {jobs.data &&
        (c.can('jobs.manage_policy') ? (
          <CommandForm
            className=""
            label="Save job rules"
            submit={(form) =>
              api.POST('/api/companies/{company_id}/job-participation-policy', {
                params: { path: c.path },
                body: {
                  expected_revision: jobs.data.revision,
                  self_join_mode: text(form, 'join') as ParticipationMode,
                  self_leave_mode: text(form, 'leave') as ParticipationMode,
                },
              })
            }
          >
            <div className="settings-fields">
              <SelectField
                label="Employees joining jobs"
                name="join"
                compact
                searchable={false}
                required
                defaultValue={jobs.data.self_join_mode}
                options={PARTICIPATION_OPTIONS}
              />
              <SelectField
                label="Employees leaving jobs"
                name="leave"
                compact
                searchable={false}
                required
                defaultValue={jobs.data.self_leave_mode}
                options={PARTICIPATION_OPTIONS}
              />
            </div>
          </CommandForm>
        ) : (
          <div className="admin-detail-list">
            <div>
              <strong>Employees joining jobs</strong>
              <span>{PARTICIPATION_LABELS[jobs.data.self_join_mode]}</span>
            </div>
            <div>
              <strong>Employees leaving jobs</strong>
              <span>{PARTICIPATION_LABELS[jobs.data.self_leave_mode]}</span>
            </div>
          </div>
        ))}
    </SettingsCard>
  );
}
