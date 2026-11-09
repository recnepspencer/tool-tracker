import { ErrorState, LoadingState, PageHeading } from './kit';
import { CompanyProfile, ParticipationSettings, RegistrationSettings } from './settings-controls';
import { useSettingsPageState } from './settings-state';

export function SettingsPage() {
  const state = useSettingsPageState();
  const { c, company } = state;
  const admin = c.can('company.manage') || c.can('catalog.manage') || c.can('people.manage');
  if (company.isPending && !company.data) return <LoadingState label="Loading settings…" />;
  if (!company.data)
    return <ErrorState message="Settings could not be loaded." onRetry={() => void company.refetch()} />;
  return (
    <div className="page-content admin-settings-page">
      <PageHeading
        eyebrow={admin ? 'Admin view · Settings' : 'Company workspace · Settings'}
        title="Settings"
        description="Company details and the rules your team works by."
      />
      <div className="settings-grid">
        <CompanyProfile state={state} />
        <RegistrationSettings state={state} />
        <ParticipationSettings state={state} />
      </div>
    </div>
  );
}
