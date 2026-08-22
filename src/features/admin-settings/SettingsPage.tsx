import { ErrorState, LoadingState } from '../../components/ui/AsyncState';
import { PageHeading } from '../../components/layout/PageHeading';
import { useCompanyProfile } from '../settings/use-company-profile';
import { useToolCategories } from '../settings/use-tool-categories';
import { CategoryManager } from './CategoryManager';
import { CompanySettingsForm } from './CompanySettingsForm';
import { DangerZone } from './DangerZone';
import { useSettingsMutations } from './use-settings-mutations';
import './admin-settings.css';

export function SettingsPage() {
  const company = useCompanyProfile();
  const categories = useToolCategories();
  const mutations = useSettingsMutations();
  if (company.isPending || categories.isPending) return <LoadingState label="Loading settings…" />;
  if (company.isError || categories.isError || !company.data || !categories.data)
    return (
      <ErrorState
        message="Settings could not be loaded."
        onRetry={() => {
          void company.refetch();
          void categories.refetch();
        }}
      />
    );
  const queryBlocked =
    company.isFetching ||
    company.isPaused ||
    company.isError ||
    categories.isFetching ||
    categories.isPaused ||
    categories.isError;
  const mutationError = [
    mutations.updateCompany.error,
    mutations.createCategory.error,
    mutations.renameCategory.error,
    mutations.deleteCategory.error,
    mutations.resetDemoData.error,
  ].find(Boolean);
  return (
    <div className="page-content admin-settings-page">
      <PageHeading
        eyebrow="Admin view · Settings"
        title="Settings"
        description="Manage company details, tool categories, and workspace data."
      />
      {mutationError && (
        <p className="form-error" role="alert">
          {mutationError instanceof Error ? mutationError.message : 'The settings change could not be saved.'}
        </p>
      )}
      <div className="settings-grid">
        <CompanySettingsForm company={company.data} mutations={mutations} blocked={queryBlocked} />
        <CategoryManager categories={categories.data} mutations={mutations} blocked={queryBlocked} />
        <DangerZone mutations={mutations} blocked={queryBlocked} />
      </div>
    </div>
  );
}
