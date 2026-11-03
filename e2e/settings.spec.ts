import { expect } from '@playwright/test';
import { command, invitedMember, workspace, chooseOption, test } from './support';

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
      const categoryStatus = categories.getByRole('combobox', { name: 'Category status', exact: true });
      await expect(categories).toHaveCount(access.catalog ? 1 : 0);
      if (access.catalog) {
        await categories.getByLabel('New category').fill('Measuring');
        await categories.getByRole('button', { name: 'Add category', exact: true }).click();
        await expect(categories.getByLabel('New category')).toHaveValue('');
        await categories.getByRole('button', { name: 'Rename Measuring', exact: true }).click();
        await categories.getByRole('textbox', { name: 'Rename Measuring', exact: true }).fill('Layout equipment');
        await categories.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(categories.getByText('Measuring', { exact: true })).toHaveCount(0);
        await expect(categories.getByText('Layout equipment', { exact: true })).toBeVisible();
        await categories.getByRole('button', { name: 'Archive Layout equipment', exact: true }).click();
        await expect(categories.getByText('Layout equipment', { exact: true })).toHaveCount(0);
        await chooseOption(categories, 'Category status', 'archived');
        await expect(categoryStatus).toHaveText('Archived categories');
        await expect(categories.getByText('Layout equipment', { exact: true })).toBeVisible();
        await categories.getByRole('button', { name: 'Restore Layout equipment', exact: true }).click();
        await expect(categories.getByText('Layout equipment', { exact: true })).toHaveCount(0);
      }
      const jobs = actor.getByRole('region', { name: 'Jobs', exact: true });
      const jobStatus = jobs.getByRole('combobox', { name: 'Job status', exact: true });
      await expect(jobs).toHaveCount(access.work ? 1 : 0);
      if (access.work) {
        await expect(
          jobs.getByRole('button', { name: /^(Request to join job|Join job|Leave job|Request to leave job)$/ }),
        ).toHaveCount(0);
        await expect(jobs.getByRole('switch')).toHaveCount(0);
        await jobs.getByRole('button', { name: 'Add job', exact: true }).click();
        let dialog = actor.getByRole('dialog', { name: 'Add job', exact: true });
        await chooseOption(dialog, 'Project', fixture.job.project_id);
        await dialog.getByLabel('Job number').fill('SET-2');
        await dialog.getByLabel('Job name').fill('Settings job');
        await dialog.getByRole('button', { name: 'Add job', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await jobs.getByRole('button', { name: 'Edit Settings job', exact: true }).click();
        dialog = actor.getByRole('dialog', { name: 'Edit job', exact: true });
        await dialog.getByLabel('Job name').fill('Settings electrical');
        await dialog.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await jobs.getByRole('button', { name: 'View people on Settings electrical', exact: true }).click();
        const roster = actor.getByRole('dialog', { name: 'People on Settings electrical', exact: true });
        await expect(roster.getByText('No one is on this job yet.')).toBeVisible();
        const owner = (await (await page.request.get('/api/me')).json()).memberships.find(
          (member: { company_id: string }) => member.company_id === fixture.company.id,
        );
        const assigning = roster.getByRole('region', { name: 'Assign a person', exact: true });
        await chooseOption(assigning, 'Person', owner.membership_id);
        await chooseOption(assigning, 'Responsibility', 'foreman');
        await assigning.getByLabel('Reason', { exact: true }).fill('Assigned from company settings');
        await assigning.getByRole('button', { name: 'Assign', exact: true }).click();
        await expect(roster.getByRole('article', { name: 'Workspace Owner foreman', exact: true })).toBeVisible();
        await actor.keyboard.press('Escape');
        await expect(roster).toHaveCount(0);
        await jobs.getByRole('button', { name: 'Archive Settings electrical', exact: true }).click();
        dialog = actor.getByRole('dialog', { name: 'Archive job', exact: true });
        await dialog.getByRole('button', { name: 'Archive job', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await chooseOption(jobs, 'Job status', 'archived');
        await expect(jobStatus).toHaveText('Archived jobs');
        await expect(jobs.getByRole('article', { name: 'Settings electrical', exact: true })).toBeVisible();
        await actor.reload();
        await expect(jobStatus).toHaveText('Archived jobs');
        if (access.catalog) await expect(categoryStatus).toHaveText('Archived categories');
        await jobs.getByRole('button', { name: 'Restore Settings electrical', exact: true }).click();
        await expect(jobs.getByRole('article', { name: 'Settings electrical', exact: true })).toHaveCount(0);
        await chooseOption(jobs, 'Job status', 'active');
        await expect(jobStatus).toHaveText('Active jobs');
        await expect(jobs.getByRole('button', { name: 'View people on Settings electrical', exact: true })).toHaveText(
          '0 people',
        );
        if (access.catalog) await expect(categoryStatus).toHaveText('Archived categories');
      }
      if (access.catalog) {
        await chooseOption(categories, 'Category status', 'active');
        await expect(categoryStatus).toHaveText('Active categories');
        await expect(categories.getByText('Layout equipment', { exact: true })).toBeVisible();
        const active = (await (await page.request.get(`${fixture.base}/tool-categories`)).json()).items;
        expect(active.map((category: { name: string }) => category.name)).toEqual(['Drills', 'Layout equipment']);
      }
      const registration = actor.getByRole('region', { name: 'Employee tool uploads', exact: true });
      const registrationSwitch = registration.getByRole('switch', { name: 'Employees can register tools' });
      await expect(registrationSwitch).toHaveCount(access.tools ? 1 : 0);
      const registrationPolicy = async () =>
        (await (await page.request.get(`${fixture.base}/tool-registration-policy`)).json())
          .employee_tool_creation_enabled;
      if (access.tools) {
        await expect(registrationSwitch).toHaveAttribute('aria-checked', 'true');
        await registrationSwitch.click();
        await expect(registrationSwitch).toHaveAttribute('aria-checked', 'false');
        await expect(registrationSwitch).toBeEnabled();
        await expect.poll(registrationPolicy).toBe(false);
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
        await chooseOption(participation, 'Employees joining jobs', 'approval_required');
        await chooseOption(participation, 'Employees leaving jobs', 'disabled');
        await participation.getByRole('button', { name: 'Save job rules', exact: true }).click();
        await expect
          .poll(async () => {
            const policy = await (await page.request.get(`${fixture.base}/job-participation-policy`)).json();
            return [policy.self_join_mode, policy.self_leave_mode];
          })
          .toEqual(['approval_required', 'disabled']);
      } else {
        await expect(participation.getByText('Employees decide directly', { exact: true })).toBeVisible();
        await expect(participation.getByText('Manager approval required', { exact: true })).toBeVisible();
      }
      expect(await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json()).toEqual(
        custody,
      );
      await actor.reload();
      await expect(actor.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
      if (access.tools) await expect(registrationSwitch).toHaveAttribute('aria-checked', 'false');
      if (access.work)
        await expect(participation.getByRole('combobox', { name: 'Employees leaving jobs', exact: true })).toHaveText(
          'Managers assign only',
        );
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
