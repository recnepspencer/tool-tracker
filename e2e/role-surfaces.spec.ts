import { expect } from '@playwright/test';
import { command, workspace, invitedMember, test } from './support';

// Each role can do everything the one before it can: a foreman holds, requests and hands off
// tools and joins jobs; a manager also runs tools, the catalog, warehouses and jobs; an admin
// also manages people and the company. `pages` is the Menu's page list, in order.
const cases = [
  {
    role: 'admin',
    manage: true,
    people: true,
    home: 'Queue',
    pages: [
      'Queue',
      'Inventory',
      'My tools',
      'Checkout',
      'Jobs',
      'People',
      'Foremen',
      'Warehouses',
      'Catalog',
      'Activity',
      'Settings',
    ],
  },
  {
    role: 'manager',
    manage: true,
    people: false,
    home: 'Queue',
    pages: [
      'Queue',
      'Inventory',
      'My tools',
      'Checkout',
      'Jobs',
      'Foremen',
      'Warehouses',
      'Catalog',
      'Activity',
      'Settings',
    ],
  },
  {
    role: 'foreman',
    manage: false,
    people: false,
    home: 'My tools',
    pages: ['My tools', 'Checkout', 'My jobs', 'Foremen', 'Activity'],
  },
  {
    // A foreman who manages a warehouse works from its Queue in the control room.
    role: 'foreman',
    scope: 'warehouse',
    manage: false,
    people: false,
    home: 'Queue',
    pages: ['Queue', 'Inventory', 'My tools', 'Checkout', 'My jobs', 'Foremen', 'Activity'],
  },
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
      const failures: string[] = [];
      actor.on('pageerror', (error) => failures.push(error.message));
      actor.on('response', (response) => {
        if (response.url().includes('/api/') && response.status() >= 400)
          failures.push(`${response.status()} ${response.url()}`);
      });
      await actor.goto('/app');
      await expect(actor.getByRole('heading', { level: 1, name: item.home, exact: true })).toBeVisible();
      const routes = [
        // Every role holds tools, so every role can reach the tool pages by address.
        ['/app/tools', 'Inventory', true],
        ['/app/mine', 'My tools', true],
        ['/app/checkout', 'Browse tools', true],
        ['/app/flagged', 'Damaged & lost', true],
        ['/app/operations', 'Queue', true],
        ['/app/directory', 'Foremen', true],
        ['/app/jobs', item.manage ? 'Jobs' : 'My jobs', true],
        ['/app/people', 'People', item.people],
        ['/app/access', 'Access guide', item.people],
        ['/app/warehouses', 'Warehouses', item.manage],
        ['/app/catalog', 'Catalog', item.manage],
        ['/app/reconciliations', 'Reconciliation', item.manage],
        // The control room shows the company audit log; the field shell shows the person's movement record.
        ['/app/activity', /^(Audit log|Movement record)$/, true],
        ['/app/settings', 'Settings', true],
      ] as const;
      for (const [url, heading, permitted] of routes) {
        await actor.goto(url);
        if (permitted) {
          await expect(actor.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible();
          await expect(actor.getByText('Loading…', { exact: true })).toHaveCount(0);
          await expect(actor.getByRole('alert')).toHaveCount(0);
          if (url === '/app/warehouses' && !item.people) {
            await actor.getByRole('button', { name: 'Open Main warehouse', exact: true }).click();
            const warehouse = actor.getByRole('dialog', { name: 'Edit warehouse', exact: true });
            await expect(warehouse).toBeVisible();
            await expect(warehouse.getByRole('group', { name: 'Managers', exact: true })).toHaveCount(0);
          }
          if (url === '/app/jobs') {
            await expect(actor.getByRole('button', { name: 'Add job', exact: true })).toHaveCount(item.manage ? 1 : 0);
            const roster = actor.getByRole('button', { name: 'Open Library wiring', exact: true });
            if (heading === 'My jobs') {
              // The field "My jobs" list has no roster; without self-join each job is a plain row.
              await expect(actor.getByRole('group', { name: 'Library wiring', exact: true })).toBeVisible();
              await expect(roster).toHaveCount(0);
            } else {
              await roster.click();
              const job = actor.getByRole('dialog', { name: 'Library wiring', exact: true });
              await expect(job.getByRole('button', { name: 'Edit people', exact: true })).toHaveCount(
                item.manage ? 1 : 0,
              );
              await actor.keyboard.press('Escape');
            }
          }
          if (url === '/app/settings') {
            await expect(actor.getByRole('region', { name: 'Company profile', exact: true })).toHaveCount(1);
            // Only an admin edits the company profile; its Save button waits for a change.
            await expect(actor.getByRole('textbox', { name: 'Company name', exact: true })).toHaveCount(
              item.people ? 1 : 0,
            );
            await expect(actor.getByRole('button', { name: 'Save company', exact: true })).toHaveCount(0);
          }
        } else
          await expect(actor.getByText('Your company permissions do not allow access to this page.')).toBeVisible();
      }
      await actor.setViewportSize({ width: 390, height: 844 });
      await actor.goto('/app');
      // /app redirects to the role's home once the session loads; that navigation closes an open sheet.
      await expect(actor.getByRole('heading', { level: 1, name: item.home, exact: true })).toBeVisible();
      const tabs = actor.getByRole('navigation', { name: 'Main', exact: true });
      await expect(tabs).toBeVisible();
      // Menu, the last tab, names every page the role can reach, and holds the account.
      const menuTab = tabs.getByRole('button', { name: 'Menu', exact: true });
      const menu = actor.getByRole('dialog', { name: 'Menu', exact: true });
      await menuTab.click();
      const pages = menu.getByRole('navigation', { name: 'Pages', exact: true });
      await expect(pages.getByRole('link')).toHaveText(item.pages);
      const appearance = actor.getByRole('switch', { name: 'Appearance', exact: true });
      await expect(appearance).not.toBeChecked();
      await appearance.click();
      await expect(appearance).toBeChecked();
      await expect(actor.locator('.experience')).toHaveAttribute('data-theme', 'light');
      await actor.keyboard.press('Escape');
      await expect(menu).toHaveCount(0);
      await actor.reload();
      await expect(actor.locator('.experience')).toHaveAttribute('data-theme', 'light');
      await expect(actor.locator('.experience')).toHaveCSS('background-color', 'rgb(244, 247, 251)');
      await expect(actor.getByRole('heading', { level: 1, name: item.home, exact: true })).toBeVisible();
      await menuTab.click();
      await expect(appearance).toBeChecked();
      await appearance.click();
      await expect(appearance).not.toBeChecked();
      await actor.keyboard.press('Escape');
      await expect(menu).toHaveCount(0);
      await actor.reload();
      await expect(actor.locator('.experience')).toHaveAttribute('data-theme', 'dark');
      await expect(actor.locator('.experience')).toHaveCSS('background-color', 'rgb(6, 8, 12)');
      expect(await actor.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(failures).toEqual([]);
    } finally {
      await context.close();
    }
  });
