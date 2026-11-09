import { ErrorState, LoadingState, PageHeading } from './kit';
import { CompanyProfile, ParticipationSettings, RegistrationSettings } from './settings-controls';
import { useSettingsPageState } from './settings-state';

export function SettingsPage() {
  const state = useSettingsPageState();
  const { company } = state;
  if (company.isPending && !company.data) return <LoadingState label="Loading settings…" />;
  if (!company.data)
    return <ErrorState message="Settings could not be loaded." onRetry={() => void company.refetch()} />;
  return (
    <div className="page-content admin-settings-page">
      <PageHeading title="Settings" description="Company details and the rules your team works by." />
      <CompanyProfile state={state} />
      <RegistrationSettings state={state} />
      <ParticipationSettings state={state} />
    </div>
  );
}
