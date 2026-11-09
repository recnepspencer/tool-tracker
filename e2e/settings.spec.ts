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
  test(`${access.role} uses settings for company details and the rules the team works by`, async ({
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
      // Categories and jobs are managed on Catalog and Jobs, not here.
      await expect(actor.getByRole('region', { name: 'Tool categories', exact: true })).toHaveCount(0);
      await expect(actor.getByRole('region', { name: 'Jobs', exact: true })).toHaveCount(0);
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
