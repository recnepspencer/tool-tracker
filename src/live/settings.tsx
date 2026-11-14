import { Link } from 'react-router-dom';
import { AccountPassword } from './account-password';
import { SettingsCard } from './settings-command';
import { CategoryManager } from './category-manager';
import { JobsPage } from './jobs';
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
        description="Manage company details, jobs, tool categories, and team rules."
      />
      <div className="settings-grid">
        <SettingsCard eyebrow="Account security">
          <AccountPassword className="button button--secondary" />
        </SettingsCard>
        <CompanyProfile state={state} />
        {c.can('jobs.manage') && <JobsPage embedded />}
        {c.can('catalog.manage') && (
          <CategoryManager
            categories={state.categories}
            archived={state.categoryArchived}
            onArchivedChange={state.setCategoryArchived}
            footer={
              <Link className="text-link" to="/app/catalog">
                Manage tool types
              </Link>
            }
          />
        )}
        <RegistrationSettings state={state} />
        <ParticipationSettings state={state} />
      </div>
    </div>
  );
}
