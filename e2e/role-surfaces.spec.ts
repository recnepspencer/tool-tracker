import { test, expect } from '@playwright/test';
import { command, workspace, invitedMember } from './support';

const cases = [
  { role: 'company_admin', equipment: true, catalog: true, people: true, work: true, home: 'Queue' },
  { role: 'equipment_manager', equipment: true, catalog: true, people: false, work: false, home: 'Queue' },
  { role: 'dispatcher', equipment: false, catalog: false, people: false, work: true, home: 'Jobs' },
  { role: 'estimator', equipment: false, catalog: false, people: false, work: false, home: 'Jobs' },
  { role: 'field_member', equipment: true, catalog: false, people: false, work: false, home: 'My tools' },
  {
    role: 'field_member',
    scope: 'warehouse',
    equipment: true,
    catalog: false,
    people: false,
    work: false,
    home: 'Queue',
  },
  {
    role: 'field_member',
    scope: 'foreman',
    equipment: true,
    catalog: false,
    people: false,
    work: false,
    home: 'My tools',
  },
  { role: 'dispatcher', scope: 'combined', equipment: true, catalog: true, people: false, work: true, home: 'Queue' },
];

for (const item of cases)
  test(`${item.role}${item.scope ? ` with ${item.scope}` : ''} has coherent desktop and mobile routes`, async ({
    page,
    browser,
  }) => {
    const fixture = await workspace(page);
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
    const actor = await context.newPage();
    try {
      const member = await invitedMember(page, actor, fixture.base, item.role);
      if (item.scope === 'warehouse')
        await command(page.request, `${fixture.base}/warehouses/${fixture.warehouse.id}/authority`, {
          expected_revision: fixture.warehouse.revision,
          membership_id: member.id,
          enabled: true,
        });
      if (item.scope === 'foreman')
        await command(page.request, `${fixture.base}/jobs/${fixture.job.id}/assignments`, {
          expected_revision: fixture.job.revision,
          membership_id: member.id,
          responsibility: 'foreman',
          reason: 'Lead the crew',
        });
      if (item.scope === 'combined')
        await command(page.request, `${fixture.base}/people/${member.id}/update`, {
          expected_revision: member.revision,
          access_state: 'active',
          roles: ['dispatcher', 'equipment_manager'],
          reason: 'Combined operational responsibilities',
        });
      const failures: string[] = [];
      actor.on('pageerror', (error) => failures.push(error.message));
      actor.on('response', (response) => {
        if (response.url().includes('/api/') && response.status() >= 400)
          failures.push(`${response.status()} ${response.url()}`);
      });
      await actor.goto('/app');
      await expect(actor.getByRole('heading', { name: item.home, exact: true })).toBeVisible();
      const routes = [
        ['/app/tools', 'Inventory', item.equipment],
        ['/app/mine', 'My tools', item.equipment],
        ['/app/checkout', 'Checkout', item.equipment],
        ['/app/flagged', 'Damaged & lost', item.equipment],
        ['/app/operations', 'Queue', item.equipment],
        ['/app/directory', 'Foremen', item.equipment],
        ['/app/jobs', item.equipment && !item.work ? 'My jobs' : 'Jobs', true],
        ['/app/people', 'People', item.people],
        ['/app/access', 'Access', item.people],
        ['/app/warehouses', 'Warehouses', item.catalog],
        ['/app/catalog', 'Catalog & warehouses', item.catalog],
        ['/app/reconciliations', 'Reconciliation', item.catalog],
        ['/app/activity', 'Activity', true],
        ['/app/settings', 'Settings', true],
      ] as const;
      for (const [url, heading, permitted] of routes) {
        await actor.goto(url);
        if (permitted) {
          await expect(actor.getByRole('heading', { name: heading, exact: true })).toBeVisible();
          await expect(actor.getByText('Loading…', { exact: true })).toHaveCount(0);
          await expect(actor.getByRole('alert')).toHaveCount(0);
          if (url === '/app/warehouses' && !item.people) {
            await actor.getByRole('button', { name: 'Main warehouse', exact: true }).click();
            await expect(actor.getByRole('region', { name: 'Management authority' })).toHaveCount(0);
          }
          if (url === '/app/jobs') {
            await expect(actor.getByRole('button', { name: 'Add job', exact: true })).toHaveCount(item.work ? 1 : 0);
            await actor.getByRole('button', { name: 'View people on Library wiring', exact: true }).click();
            await expect(actor.getByRole('region', { name: 'Assign a person', exact: true })).toHaveCount(
              item.work ? 1 : 0,
            );
            await actor.keyboard.press('Escape');
          }
          if (url === '/app/settings') {
            await expect(actor.getByRole('region', { name: 'Company profile', exact: true })).toHaveCount(1);
            await expect(actor.getByRole('button', { name: 'Save company', exact: true })).toHaveCount(
              item.people ? 1 : 0,
            );
          }
        } else
          await expect(actor.getByText('Your company permissions do not allow access to this page.')).toBeVisible();
      }
      await actor.setViewportSize({ width: 390, height: 844 });
      await actor.goto('/app');
      await actor.getByRole('button', { name: 'Open navigation', exact: true }).click();
      const nav = actor.getByRole('dialog', { name: 'Navigation' });
      await expect(nav).toBeVisible();
      await expect(nav.getByRole('link', { name: 'People', exact: true })).toHaveCount(item.people ? 1 : 0);
      await expect(nav.getByRole('link', { name: 'Warehouses', exact: true })).toHaveCount(item.catalog ? 1 : 0);
      await nav.getByRole('button', { name: 'Light appearance', exact: true }).click();
      await expect(actor.locator('.experience')).toHaveAttribute('data-theme', 'light');
      await actor.keyboard.press('Escape');
      await expect(nav).toHaveCount(0);
      await actor.reload();
      await expect(actor.locator('.experience')).toHaveAttribute('data-theme', 'light');
      await expect(actor.locator('.experience')).toHaveCSS('background-color', 'rgb(244, 247, 251)');
      await actor.getByRole('button', { name: 'Open navigation', exact: true }).click();
      await nav.getByRole('button', { name: 'Dark appearance', exact: true }).click();
      await actor.keyboard.press('Escape');
      await expect(nav).toHaveCount(0);
      await actor.reload();
      await expect(actor.locator('.experience')).toHaveAttribute('data-theme', 'dark');
      await expect(actor.locator('.experience')).toHaveCSS('background-color', 'rgb(6, 8, 12)');
      expect(await actor.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(failures).toEqual([]);
    } finally {
      await context.close();
    }
  });
