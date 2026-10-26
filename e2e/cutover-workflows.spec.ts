import { test, expect } from '@playwright/test';
import { command, workspace, invitedMember } from './support';

test('activity paging preserves filters and reloads the selected page', async ({ page }) => {
  const fixture = await workspace(page);
  for (let index = 0; index < 30; index++)
    await command(page.request, `${fixture.base}/tool-categories`, { name: `Paging category ${index}` });
  await expect
    .poll(
      async () =>
        (
          await (
            await page.request.get(
              `${fixture.base}/activity?search=equipment.category.created&kind=admin&mine=true&limit=100`,
            )
          ).json()
        ).items.length,
      { timeout: 20_000 },
    )
    .toBe(31);
  await page.goto('/app/activity');
  await page.getByRole('button', { name: 'Admin', exact: true }).click();
  await page.getByLabel('Search activity').fill('equipment.category.created');
  await page.getByLabel('Only my activity').click();
  await expect(page.getByLabel('Only my activity')).toBeChecked();
  await expect(page.getByRole('article')).toHaveCount(30);
  await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(1);
  expect(new URL(page.url()).searchParams.get('offset')).toBe('30');
  await page.reload();
  await expect(page.getByLabel('Search activity')).toHaveValue('equipment.category.created');
  await expect(page.getByLabel('Only my activity')).toBeChecked();
  await expect(page.getByRole('button', { name: 'Admin', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(30);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByLabel('Search activity').fill('no-such-event');
  await expect(page.getByText('No activity matches these filters.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
  expect(new URL(page.url()).searchParams.has('offset')).toBe(false);
});

test('company profile and warehouse dialogs persist changes and recover stale drafts', async ({ page }) => {
  const fixture = await workspace(page);
  await page.goto('/app/settings');
  const profile = page.getByRole('region', { name: 'Company profile', exact: true });
  await profile.getByLabel('Company name').fill('Updated Electrical');
  await profile.getByLabel('Address', { exact: true }).fill('42 Service Road');
  await profile.getByLabel('Timezone').fill('America/Chicago');
  await profile.getByRole('button', { name: 'Save company', exact: true }).click();
  await expect(profile.getByRole('status')).toBeVisible();
  await page.reload();
  await expect(profile.getByLabel('Company name')).toHaveValue('Updated Electrical');
  await expect(profile.getByLabel('Address', { exact: true })).toHaveValue('42 Service Road');
  await profile.getByLabel('Company name').fill('My unsaved change');
  const current = await (await page.request.get(fixture.base)).json();
  await command(page.request, `${fixture.base}/update`, {
    expected_revision: current.revision,
    name: 'Other administrator',
    address: current.address,
    timezone: current.timezone,
  });
  await profile.getByRole('button', { name: 'Save company', exact: true }).click();
  await expect(profile.getByRole('alert')).toBeVisible();
  await expect(profile.getByLabel('Company name')).toHaveValue('My unsaved change');
  await profile.getByRole('button', { name: 'Load latest values' }).click();
  await expect(profile.getByLabel('Company name')).toHaveValue('Other administrator');
  await page.goto('/app/warehouses');
  await page.getByRole('button', { name: 'Add warehouse', exact: true }).click();
  const create = page.getByRole('dialog', { name: 'Add warehouse' });
  await create.getByLabel('Code', { exact: true }).fill('EAST');
  await create.getByLabel('Name', { exact: true }).fill('East warehouse');
  await create.getByLabel('Address', { exact: true }).fill('77 East Road');
  await create.getByRole('button', { name: 'Create warehouse', exact: true }).click();
  await expect(create).toHaveCount(0);
  await page.getByRole('button', { name: 'East warehouse', exact: true }).click();
  const warehouse = page.getByRole('dialog', { name: 'Warehouse details' });
  await expect(warehouse).toBeVisible();
  await page.screenshot({ path: 'artifacts/parity-warehouse-dialog.png', fullPage: true });
  await warehouse.getByLabel('Archived', { exact: true }).check();
  let releaseRead!: () => void;
  let readStarted!: () => void;
  const slowRead = new Promise<void>((resolve) => {
    releaseRead = resolve;
  });
  const started = new Promise<void>((resolve) => {
    readStarted = resolve;
  });
  await page.route(
    `**${fixture.base}/tool-registration-policy`,
    async (route) => {
      const response = await route.fetch();
      readStarted();
      await slowRead;
      await route.fulfill({ response });
    },
    { times: 1 },
  );
  try {
    await warehouse.getByRole('button', { name: 'Save warehouse', exact: true }).click();
    await started;
    await expect(warehouse).toHaveCount(0);
    // Saving and closing must finish before a slow background read; the next
    // user's navigation must not be replaced by a delayed close callback.
    await expect(page).toHaveURL(/\/app\/warehouses$/);
    await page.getByLabel('Show archived warehouses').click();
    await expect(page.getByLabel('Show archived warehouses')).toBeChecked();
  } finally {
    releaseRead();
  }
  await page.getByRole('button', { name: 'East warehouse', exact: true }).click();
  await warehouse.getByLabel('Archived', { exact: true }).uncheck();
  await warehouse.getByRole('button', { name: 'Save warehouse', exact: true }).click();
  await expect(warehouse).toHaveCount(0);
  await page.getByLabel('Show archived warehouses').click();
  await expect(page.getByLabel('Show archived warehouses')).not.toBeChecked();
  await page.getByRole('button', { name: 'Main warehouse', exact: true }).click();
  await warehouse.getByLabel('Archived', { exact: true }).check();
  await warehouse.getByRole('button', { name: 'Save warehouse', exact: true }).click();
  await expect(warehouse.getByRole('alert')).toContainText('Resolve warehouse custody');
  expect(
    (await (await page.request.get(`${fixture.base}/warehouses`)).json()).items.find(
      (item: { id: string }) => item.id === fixture.warehouse.id,
    ).archived_at,
  ).toBeNull();
});

test('closing a saving sheet does not navigate back when its committed response arrives', async ({ page }) => {
  const fixture = await workspace(page);
  await page.goto('/app/warehouses');
  await page.getByRole('button', { name: 'Main warehouse', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Warehouse details', exact: true });
  await sheet.getByLabel('Name', { exact: true }).fill('Updated main warehouse');
  let releaseResponse!: () => void;
  let committed = false;
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  await page.route(
    `**${fixture.base}/warehouses/${fixture.warehouse.id}/update`,
    async (route) => {
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      committed = true;
      await responseGate;
      await route.fulfill({ response });
    },
    { times: 1 },
  );
  try {
    await sheet.getByRole('button', { name: 'Save warehouse', exact: true }).click();
    await expect.poll(() => committed).toBe(true);
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await page.getByRole('link', { name: 'Inventory', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();
    const refreshed = page.waitForResponse(
      (response) =>
        response.url().endsWith(`${fixture.base}/tool-registration-policy`) && response.request().method() === 'GET',
    );
    releaseResponse();
    await refreshed;
    await expect(
      page
        .getByLabel('Warehouse', { exact: true })
        .getByRole('option', { name: 'Updated main warehouse', exact: true }),
    ).toHaveCount(1);
    await expect(page).toHaveURL(/\/app\/tools$/);
  } finally {
    releaseResponse();
  }
});

test('foremen directory filters actual assignments and preserves held tool identity', async ({ page, browser }) => {
  const fixture = await workspace(page);
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const worker = await context.newPage();
  try {
    const member = await invitedMember(page, worker, fixture.base, 'field_member', 'Assigned Foreman');
    const assignment = await command(page.request, `${fixture.base}/jobs/${fixture.job.id}/assignments`, {
      expected_revision: fixture.job.revision,
      membership_id: member.id,
      responsibility: 'foreman',
      reason: 'Lead installation',
    });
    expect(assignment).toMatchObject({ membership_id: member.id, responsibility: 'foreman' });
    const handoff = await command(page.request, `${fixture.base}/tools/${fixture.asset.id}/handoffs`, {
      request_key: crypto.randomUUID(),
      expected_revision: fixture.asset.revision,
      destination_membership_id: member.id,
    });
    await command(worker.request, `${fixture.base}/handoffs/${handoff.id}/accept`, {
      expected_revision: handoff.revision,
    });
    await page.goto('/app/directory');
    await page.getByLabel('Filter by job').selectOption(fixture.job.id);
    const person = page
      .locator('.foreman-card')
      .filter({ has: page.getByRole('heading', { name: 'Assigned Foreman', exact: true }) });
    await expect(person).toBeVisible();
    await person.locator('summary').click();
    await expect(person.getByText(/^UNIT-001/)).toBeVisible();
    await page.screenshot({ path: 'artifacts/parity-foremen-directory.png', fullPage: true });
    await page.getByLabel('Search foremen, jobs, or tools').fill('UNIT-001');
    await page.reload();
    await expect(page.getByLabel('Filter by job')).toHaveValue(fixture.job.id);
    await expect(person.getByText(/^UNIT-001/)).toBeVisible();
    await page.getByLabel('Filter by job').selectOption('none');
    await expect(person).toHaveCount(0);
    await page.goto(`/app/tools/${fixture.asset.id}`);
    await expect(page.getByRole('region', { name: 'Current custody', exact: true })).toContainText('Assigned Foreman');
    await expect(page.getByRole('region', { name: 'Transfer or return' })).toHaveCount(0);
    await worker.goto(`/app/mine/${fixture.asset.id}`);
    await worker.getByRole('button', { name: 'Transfer tool', exact: true }).click();
    await expect(worker.getByRole('region', { name: 'Transfer or return' })).toBeVisible();
    expect(
      (await (await worker.request.get(`${fixture.base}/tools/${fixture.asset.id}`)).json()).holder_membership_id,
    ).toBe(member.id);
  } finally {
    await context.close();
  }
});

test('photo-first registration survives a lost server response without duplicating the unit', async ({ page }) => {
  const fixture = await workspace(page);
  const model = await command(page.request, `${fixture.base}/tool-models`, {
    category_id: fixture.asset.category_id,
    name: 'Hammer drill',
    manufacturer: 'DeWalt',
    model_number: 'DCD996',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/tools/new');
  await expect(page.getByRole('heading', { name: 'Start with a photo' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/parity-registration-capture-mobile.png', fullPage: true });
  await page.getByLabel('Tool photo (up to 8 MB)').setInputFiles('e2e/fixtures/hammer-drill.jpg');
  await page.getByLabel('Tool model').selectOption(model.id);
  await page.getByLabel('Starting warehouse').selectOption(fixture.warehouse.id);
  await page.getByLabel('Unique asset tag').fill('RETRY-PHOTO');
  await page.getByRole('button', { name: 'Change photo' }).click();
  await page.getByLabel('Tool photo (up to 8 MB)').setInputFiles('e2e/fixtures/hammer-drill.jpg');
  await expect(page.getByLabel('Unique asset tag')).toHaveValue('RETRY-PHOTO');
  await page.screenshot({ path: 'artifacts/parity-registration-details-mobile.png', fullPage: true });
  await page.route(
    `**${fixture.base}/tools`,
    async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      const response = await route.fetch();
      expect(response.status()).toBe(201); // The real command committed, but the browser loses its response.
      await route.abort('connectionreset');
    },
    { times: 1 },
  );
  await page.getByRole('button', { name: 'Register tool', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Register tool', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open its custody record' })).toBeVisible();
  const tools = (await (await page.request.get(`${fixture.base}/tools?search=RETRY-PHOTO`)).json()).items;
  expect(tools).toHaveLength(1);
  expect(tools[0]).toMatchObject({ warehouse_id: fixture.warehouse.id, holder_membership_id: null });
  expect(tools[0].registration_photo_id).toBeTruthy();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/parity-registration-mobile.png', fullPage: true });
});

test('activity filters read actual audit events with own versus company visibility', async ({ page, browser }) => {
  const fixture = await workspace(page);
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const worker = await context.newPage();
  try {
    await invitedMember(page, worker, fixture.base, 'field_member');
    await command(worker.request, `${fixture.base}/tools/${fixture.asset.id}/requests`, {
      request_key: crypto.randomUUID(),
      note: 'For the next shift',
    });
    await expect
      .poll(async () => (await (await worker.request.get(`${fixture.base}/activity?kind=request`)).json()).items.length)
      .toBe(1);
    await page.goto('/app/activity');
    await page.getByRole('button', { name: 'Requests', exact: true }).click();
    await page.getByLabel('Search activity').fill('UNIT-001');
    await page.getByLabel('Warehouse', { exact: true }).selectOption(fixture.warehouse.id);
    await expect(page.getByRole('button', { name: 'Requests', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Search activity')).toHaveValue('UNIT-001');
    await expect(page.getByLabel('Warehouse', { exact: true })).toHaveValue(fixture.warehouse.id);
    await expect(page.getByText('Tool requested', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'artifacts/parity-activity-filtered.png', fullPage: true });
    await page.reload();
    await expect(page.getByLabel('Search activity')).toHaveValue('UNIT-001');
    await expect(page.getByRole('button', { name: 'Requests', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Warehouse', { exact: true })).toHaveValue(fixture.warehouse.id);
    await page.getByLabel('Only my activity').click();
    await expect(page.getByLabel('Only my activity')).toBeChecked();
    await expect(page).toHaveURL(/mine=true/);
    await expect(page.getByText('No activity matches these filters.')).toBeVisible();
    await worker.goto('/app/activity?kind=admin');
    await expect(worker.getByText('Invitation accepted', { exact: true })).toBeVisible();
    await expect(worker.getByText('Company created', { exact: true })).toHaveCount(0);
    await worker.getByRole('button', { name: 'Requests', exact: true }).click();
    await expect(worker.getByText('Tool requested', { exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});
