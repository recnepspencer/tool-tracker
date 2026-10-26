import { test, expect } from '@playwright/test';
import { command, invitedMember, workspace } from './support';

const roles = [
  { role: 'company_admin', company: true, catalog: true, work: true, tools: true },
  { role: 'equipment_manager', company: false, catalog: true, work: false, tools: true },
  { role: 'dispatcher', company: false, catalog: false, work: true, tools: false },
  { role: 'field_member', company: false, catalog: false, work: false, tools: false },
  { role: 'estimator', company: false, catalog: false, work: false, tools: false },
];

for (const access of roles)
  test(`${access.role} uses settings with the same saved company, catalog and job behavior as the main workspaces`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(150_000);
    const fixture = await workspace(page);
    await command(page.request, `${fixture.base}/tool-registration-policy`, {
      expected_revision: 1,
      employee_tool_creation_enabled: true,
    });
    await command(page.request, `${fixture.base}/job-participation-policy`, {
      expected_revision: 1,
      self_join_mode: 'direct',
      self_leave_mode: 'approval_required',
    });
    const context = await browser.newContext({
      baseURL: 'http://127.0.0.1:4173',
      viewport: { width: 390, height: 844 },
    });
    const actor = access.company ? page : await context.newPage();
    const errors: string[] = [];
    actor.on('pageerror', (error) => errors.push(error.message));
    actor.on('response', (response) => {
      if (response.url().includes('/api/') && response.status() >= 400)
        errors.push(`${response.status()} ${response.url()}`);
    });
    try {
      if (actor !== page) await invitedMember(page, actor, fixture.base, access.role, 'Settings reviewer');
      const custody = await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json();
      await actor.goto('/app/settings');
      await expect(actor.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
      await expect(actor.getByRole('button', { name: 'Reset workspace data', exact: true })).toHaveCount(0);
      const company = actor.getByRole('region', { name: 'Company profile', exact: true });
      await expect(company.getByRole('button', { name: 'Save company', exact: true })).toHaveCount(
        access.company ? 1 : 0,
      );
      if (!access.company) {
        await expect(company.getByText(fixture.company.name, { exact: true })).toBeVisible();
        await expect(company.getByRole('textbox')).toHaveCount(0);
      }
      const categories = actor.getByRole('region', { name: 'Tool categories', exact: true });
      await expect(categories).toHaveCount(access.catalog ? 1 : 0);
      if (access.catalog) {
        await categories.getByLabel('New category').fill('Measuring');
        await categories.getByRole('button', { name: 'Create category', exact: true }).click();
        await expect(categories.getByLabel('New category')).toHaveValue('');
        const category = categories.locator('details').filter({ hasText: 'Measuring' });
        await category.locator('summary').click();
        await category.getByLabel('Category name').fill('Layout equipment');
        await category.getByRole('button', { name: 'Save category', exact: true }).click();
        await expect(category).toHaveCount(0);
        const renamed = categories.locator('details').filter({ hasText: 'Layout equipment' });
        await expect(renamed.locator('summary')).toHaveText('Layout equipment');
        await renamed.getByLabel('Archived', { exact: true }).check();
        await renamed.getByRole('button', { name: 'Save category', exact: true }).click();
        await expect(renamed).toHaveCount(0);
        await categories.getByLabel('Show archived categories').click();
        await expect(categories.getByLabel('Show archived categories')).toBeChecked();
        await expect(renamed.locator('summary')).toBeVisible();
        await renamed.locator('summary').click();
        await renamed.getByLabel('Archived', { exact: true }).uncheck();
        await renamed.getByRole('button', { name: 'Save category', exact: true }).click();
        await expect(renamed).toHaveCount(0);
      }
      const jobs = actor.getByRole('region', { name: 'Jobs', exact: true });
      await expect(jobs).toHaveCount(access.work ? 1 : 0);
      if (access.work) {
        await expect(
          jobs.getByRole('button', { name: /^(Request to join job|Join job|Leave job|Request to leave job)$/ }),
        ).toHaveCount(0);
        await jobs.getByRole('button', { name: 'Add job', exact: true }).click();
        let dialog = actor.getByRole('dialog', { name: 'Add job', exact: true });
        await dialog.getByLabel('Project', { exact: true }).selectOption(fixture.job.project_id);
        await dialog.getByLabel('Job number').fill('SET-2');
        await dialog.getByLabel('Job name').fill('Settings job');
        await dialog.getByRole('button', { name: 'Create job', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await jobs.getByRole('button', { name: 'Edit Settings job', exact: true }).click();
        dialog = actor.getByRole('dialog', { name: 'Edit job', exact: true });
        await dialog.getByLabel('Job name').fill('Settings electrical');
        await dialog.getByRole('button', { name: 'Save job', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await jobs.getByRole('button', { name: 'View people on Settings electrical', exact: true }).click();
        const roster = actor.getByRole('dialog', { name: 'Job details', exact: true });
        await expect(roster.getByText('No current assignments.')).toBeVisible();
        const owner = (await (await page.request.get('/api/me')).json()).memberships.find(
          (member: { company_id: string }) => member.company_id === fixture.company.id,
        );
        const assigning = roster.getByRole('region', { name: 'Assign a person', exact: true });
        await assigning.getByLabel('Person', { exact: true }).selectOption(owner.membership_id);
        await assigning.getByLabel('Responsibility').selectOption('foreman');
        await assigning.getByLabel('Reason', { exact: true }).fill('Assigned from company settings');
        await assigning.getByRole('button', { name: 'Save assignment', exact: true }).click();
        await expect(roster.getByRole('article', { name: 'Workspace Owner foreman', exact: true })).toBeVisible();
        await actor.keyboard.press('Escape');
        await jobs.getByRole('button', { name: 'Archive Settings electrical', exact: true }).click();
        dialog = actor.getByRole('dialog', { name: 'Archive job', exact: true });
        await dialog.getByRole('button', { name: 'Archive job', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await jobs.getByLabel('Show archived jobs').click();
        await expect(jobs.getByLabel('Show archived jobs')).toBeChecked();
        await expect(jobs.getByRole('article', { name: 'Settings electrical', exact: true })).toBeVisible();
        await actor.reload();
        await expect(jobs.getByLabel('Show archived jobs')).toBeChecked();
        if (access.catalog) await expect(categories.getByLabel('Show archived categories')).toBeChecked();
        await jobs.getByRole('button', { name: 'Restore Settings electrical', exact: true }).click();
        dialog = actor.getByRole('dialog', { name: 'Restore job', exact: true });
        await dialog.getByRole('button', { name: 'Restore job', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await jobs.getByLabel('Show archived jobs').click();
        await expect(jobs.getByLabel('Show archived jobs')).not.toBeChecked();
        await expect(jobs.getByRole('button', { name: 'View people on Settings electrical', exact: true })).toHaveText(
          '0 people',
        );
        if (access.catalog) await expect(categories.getByLabel('Show archived categories')).toBeChecked();
      }
      if (access.catalog) {
        await categories.getByLabel('Show archived categories').click();
        await expect(categories.getByLabel('Show archived categories')).not.toBeChecked();
        await expect(categories.getByText('Layout equipment', { exact: true })).toBeVisible();
        const active = (await (await page.request.get(`${fixture.base}/tool-categories`)).json()).items;
        expect(active.map((category: { name: string }) => category.name)).toEqual(['Drills', 'Layout equipment']);
      }
      const registration = actor.getByRole('region', { name: 'Employee tool uploads', exact: true });
      await expect(actor.getByRole('button', { name: 'Save registration rule', exact: true })).toHaveCount(
        access.tools ? 1 : 0,
      );
      if (access.tools) {
        await registration.getByRole('combobox').selectOption('false');
        await registration.getByRole('button', { name: 'Save registration rule', exact: true }).click();
        await expect(registration.getByRole('status')).toBeVisible();
        expect(
          (await (await page.request.get(`${fixture.base}/tool-registration-policy`)).json())
            .employee_tool_creation_enabled,
        ).toBe(false);
      } else if (access.role === 'field_member') {
        await expect(
          registration.getByText('Employees can register tools and upload photos.', { exact: true }),
        ).toBeVisible();
      }
      const participation = actor.getByRole('region', { name: 'Job participation', exact: true });
      await expect(participation.getByRole('button', { name: 'Save job rules', exact: true })).toHaveCount(
        access.work ? 1 : 0,
      );
      if (access.work) {
        await participation.getByLabel('Employees joining jobs').selectOption('approval_required');
        await participation.getByLabel('Employees leaving jobs').selectOption('disabled');
        await participation.getByRole('button', { name: 'Save job rules', exact: true }).click();
        await expect(participation.getByRole('status')).toBeVisible();
      } else {
        await expect(participation.getByText('Employees decide directly', { exact: true })).toBeVisible();
        await expect(participation.getByText('Manager approval required', { exact: true })).toBeVisible();
      }
      expect(await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json()).toEqual(
        custody,
      );
      await actor.reload();
      await expect(actor.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
      if (access.tools) await expect(registration.getByRole('combobox')).toHaveValue('false');
      if (access.work) await expect(participation.getByLabel('Employees leaving jobs')).toHaveValue('disabled');
      if (access.company) await expect(company.getByLabel('Company name')).toHaveValue(fixture.company.name);
      else await expect(company.getByText(fixture.company.name, { exact: true })).toBeVisible();
      if (!access.work)
        await expect(participation.getByText('Employees decide directly', { exact: true })).toBeVisible();
      await expect(actor.locator('main').getByText('Loading…', { exact: true })).toHaveCount(0);
      expect(await actor.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (access.company) {
        await jobs.scrollIntoViewIfNeeded();
        await actor.screenshot({ path: 'artifacts/settings-jobs-desktop.png', fullPage: true, animations: 'disabled' });
        await categories.scrollIntoViewIfNeeded();
        await actor.screenshot({
          path: 'artifacts/settings-categories-desktop.png',
          fullPage: true,
          animations: 'disabled',
        });
        await actor.getByRole('heading', { name: 'Settings', exact: true }).scrollIntoViewIfNeeded();
      }
      if (access.company || access.role === 'field_member')
        await actor.screenshot({
          path: `artifacts/settings-${access.role}.png`,
          fullPage: true,
          animations: 'disabled',
        });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
