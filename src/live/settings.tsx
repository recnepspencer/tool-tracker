import { Link } from 'react-router-dom';
import { CategoryCreate, CategoryList } from './catalog-categories';
import { errorMessage } from './client';
import { JobsPage } from './jobs';
import { CompanyProfile, ParticipationSettings, RegistrationSettings } from './settings-controls';
import { useSettingsPageState } from './settings-state';
import { Loading, Notice, Section } from './ui';
import './experience/settings.css';

export function SettingsPage() {
  const state = useSettingsPageState();
  const { c, categories, categoryArchived, visibleCategories, setCategoryArchived } = state;
  return (
    <div className="settings-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Company workspace</span>
          <h1>Settings</h1>
          <p>Company details, jobs, tool categories and team rules.</p>
        </div>
      </header>
      <div className="settings-grid">
        <CompanyProfile state={state} />
        {c.can('jobs.manage') && <JobsPage embedded />}
        {c.can('catalog.manage') && (
          <Section title="Tool categories">
            <p className="muted">Organize the shared tool catalog.</p>
            <CategoryCreate label="New category" />
            <label className="check">
              <input
                type="checkbox"
                checked={categoryArchived}
                onChange={(event) => setCategoryArchived(event.target.checked)}
              />
              Show archived categories
            </label>
            {categories.isPending && <Loading />}
            {categories.error && <Notice error>{errorMessage(categories.error)}</Notice>}
            <CategoryList categories={visibleCategories} />
            <Link to="/app/catalog">Manage tool models & warehouses</Link>
          </Section>
        )}
        <RegistrationSettings state={state} />
        <ParticipationSettings state={state} />
      </div>
    </div>
  );
}
