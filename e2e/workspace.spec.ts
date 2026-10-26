import { test, expect } from '@playwright/test';
import { command, workspace, emailLink, password } from './support';

test('physical assets remain distinct and list navigation survives refresh', async ({ page }) => {
  await workspace(page);
  await page.getByRole('button', { name: 'Expand Hammer drill, 2 tools' }).click();
  await expect(page.getByRole('link', { name: /UNIT-001/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /UNIT-002/ })).toBeVisible();
  await page.getByLabel('Search inventory', { exact: true }).fill('UNIT-002');
  await expect(page.getByRole('link', { name: /UNIT-001/ })).toHaveCount(0);
  await expect(page).toHaveURL(/search=UNIT-002/);
  await page.reload();
  await expect(page.getByLabel('Search inventory', { exact: true })).toHaveValue('UNIT-002');
  await page.getByRole('link', { name: /UNIT-002/ }).click();
  await expect(page.getByRole('heading', { name: 'Hammer drill' })).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel('Search inventory', { exact: true })).toHaveValue('UNIT-002');
  await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Add tool', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Add a tool', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Add tool', exact: true })).toBeFocused();
  await expect(page.getByLabel('Search inventory', { exact: true })).toHaveValue('UNIT-002');
  await page.screenshot({ path: 'artifacts/workspace-overview-desktop.png', fullPage: true });
});

test('condition incidents and service do not change custody or the other physical unit', async ({ page }) => {
  const fixture = await workspace(page);
  await page.getByRole('button', { name: 'Expand Hammer drill, 2 tools' }).click();
  await page.getByRole('link', { name: /UNIT-001/ }).click();
  await page.getByRole('button', { name: 'Report lost', exact: true }).click();
  const report = page.getByRole('region', { name: 'Report a problem', exact: true });
  await report.getByLabel('Problem').selectOption('missing');
  await report.getByLabel('What happened?').fill('Could not locate during stock check');
  await report.getByRole('button', { name: 'Submit report' }).click();
  await expect(page.getByText('Could not locate during stock check', { exact: true })).toBeVisible();
  await page.getByLabel('Where was it found?').fill('Located in secured cabinet');
  await page.getByRole('button', { name: 'Mark found', exact: true }).click();
  await expect(page.getByText('No open reports.')).toBeVisible();
  await page.getByText('Manage this tool', { exact: true }).click();
  const service = page.getByRole('region', { name: 'Record service', exact: true });
  await service.getByLabel('Condition').selectOption('damaged');
  await service.getByLabel('Work performed').fill('Inspection found a damaged trigger');
  await service.getByRole('button', { name: 'Save service record' }).click();
  await expect(service.getByRole('status')).toBeVisible();
  const current = await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}`)).json();
  const other = await (await page.request.get(`${fixture.base}/tools/${fixture.second.id}`)).json();
  expect(current).toMatchObject({ missing: false, serviceability: 'damaged', warehouse_id: fixture.warehouse.id });
  expect(other).toMatchObject({ missing: false, serviceability: 'serviceable', warehouse_id: fixture.warehouse.id });
  const lifecycle = page.getByRole('region', { name: 'Retire or restore', exact: true });
  await lifecycle.getByLabel('Lifecycle').selectOption('retired');
  await lifecycle.getByLabel('Reason').fill('Awaiting repair');
  await lifecycle.getByRole('button', { name: 'Update lifecycle' }).click();
  await expect(lifecycle.getByRole('status')).toBeVisible();
  await lifecycle.getByLabel('Lifecycle').selectOption('active');
  await lifecycle.getByLabel('Reason').fill('Returned to inventory');
  await lifecycle.getByRole('button', { name: 'Update lifecycle' }).click();
  await expect
    .poll(async () => (await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}`)).json()).lifecycle)
    .toBe('active');
  await page.goto('/app/flagged?search=UNIT-001');
  await page.getByRole('link', { name: 'UNIT-001 Hammer drill', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/app/flagged/${fixture.asset.id}$`));
  await page.getByRole('button', { name: 'Manage this tool', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/app\/flagged\?search=UNIT-001$/);
  await expect(page.getByRole('heading', { name: 'Damaged & lost', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'UNIT-001 Hammer drill', exact: true })).toBeFocused();
});

test('editing a stale record preserves the draft until the user loads latest values', async ({ page }) => {
  const fixture = await workspace(page);
  await page.getByRole('button', { name: 'Expand Hammer drill, 2 tools' }).click();
  await page.getByRole('link', { name: /UNIT-001/ }).click();
  await page.getByText('Manage this tool', { exact: true }).click();
  const section = page.getByRole('region', { name: 'Asset information' });
  await section.getByLabel('Serial number', { exact: true }).fill('LOCAL-DRAFT');
  const current = await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}`)).json();
  await command(page.request, `${fixture.base}/tools/${fixture.asset.id}/update`, {
    expected_revision: current.revision,
    serial_number: 'OTHER-EDITOR',
  });
  await section.getByRole('button', { name: 'Update serial number' }).click();
  await expect(section.getByRole('alert')).toBeVisible();
  await expect(section.getByLabel('Serial number', { exact: true })).toHaveValue('LOCAL-DRAFT');
  await section.getByRole('button', { name: 'Load latest values' }).click();
  await expect(section.getByLabel('Serial number', { exact: true })).toHaveValue('OTHER-EDITOR');
  await section.getByLabel('Serial number', { exact: true }).fill('REVIEWED-VALUE');
  await section.getByRole('button', { name: 'Update serial number' }).click();
  await expect(section.getByRole('status')).toBeVisible();
});

test('company switching isolates inventory and policy changes survive reload', async ({ page }) => {
  const fixture = await workspace(page);
  await page.goto('/app/settings');
  const registration = page.getByRole('region', { name: 'Employee tool uploads' });
  await registration.getByLabel('Can employees register tools and upload registration photos?').selectOption('false');
  await registration.getByRole('button', { name: 'Save registration rule' }).click();
  await expect(registration.getByRole('status')).toBeVisible();
  await page.reload();
  await expect(registration.getByLabel('Can employees register tools and upload registration photos?')).toHaveValue(
    'false',
  );
  const jobs = page.getByRole('region', { name: 'Job participation', exact: true });
  await jobs.getByLabel('Employees joining jobs').selectOption('approval_required');
  await jobs.getByLabel('Employees leaving jobs').selectOption('disabled');
  await jobs.getByRole('button', { name: 'Save job rules' }).click();
  await expect
    .poll(
      async () => (await (await page.request.get(`${fixture.base}/job-participation-policy`)).json()).self_join_mode,
    )
    .toBe('approval_required');
  const second = await command(page.request, '/api/companies', {
    request_key: crypto.randomUUID(),
    name: 'Second company',
    preferred_name: 'Workspace Owner',
  });
  await page.reload();
  await page.getByRole('button', { name: 'Open account', exact: true }).click();
  await page.getByLabel('Workspace', { exact: true }).selectOption(second.id);
  await expect(page.getByRole('heading', { name: 'Queue', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Inventory', exact: true }).click();
  await expect(page.getByText('No tools match this inventory view.')).toBeVisible();
  await page.getByRole('button', { name: 'Open account', exact: true }).click();
  await page.getByLabel('Workspace', { exact: true }).selectOption(fixture.company.id);
  await expect(page.getByRole('heading', { name: 'Queue', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Inventory', exact: true }).click();
  await page.getByRole('button', { name: 'Expand Hammer drill, 2 tools' }).click();
  await expect(page.getByRole('link', { name: /UNIT-001/ })).toBeVisible();
});

test('worker participation needs approval and suspended access is revoked', async ({ page, browser }) => {
  const fixture = await workspace(page);
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const worker = await context.newPage();
  try {
    const email = `crew-${crypto.randomUUID().slice(0, 8)}@example.com`;
    const invitation = await command(page.request, `${fixture.base}/invitations`, {
      email,
      preferred_name: 'Crew Member',
      role: 'field_member',
    });
    await command(worker.request, '/api/auth/signup', { email, name: 'Crew Member' });
    const verification = new URL(await emailLink(email, '/verify-email'), 'http://localhost');
    await command(worker.request, '/api/auth/verify-signup', {
      token: verification.searchParams.get('token'),
      password,
    });
    await command(worker.request, '/api/invitations/accept', { token: invitation.token });
    const policy = await (await page.request.get(`${fixture.base}/job-participation-policy`)).json();
    await command(page.request, `${fixture.base}/job-participation-policy`, {
      expected_revision: policy.revision,
      self_join_mode: 'approval_required',
      self_leave_mode: 'direct',
    });
    const registration = await (await page.request.get(`${fixture.base}/tool-registration-policy`)).json();
    await command(page.request, `${fixture.base}/tool-registration-policy`, {
      expected_revision: registration.revision,
      employee_tool_creation_enabled: false,
    });
    await worker.goto('/app/tools/new');
    await expect(worker.getByText(/Employee tool registration is disabled/)).toBeVisible();
    await worker.goto('/app/jobs');
    await worker.getByRole('button', { name: 'Request to join job', exact: true }).click();
    await expect(worker.getByText('Join awaiting approval', { exact: true })).toBeVisible();
    await page.goto('/app/jobs');
    const requests = page.getByRole('region', { name: 'Participation requests' });
    await requests.getByRole('button', { name: 'Submit decision' }).click();
    await expect(requests.getByText('No pending participation requests.')).toBeVisible();
    await worker.reload();
    await expect(worker.getByRole('switch', { name: 'Library wiring', exact: true })).toBeChecked();
    await worker.getByRole('switch', { name: 'Library wiring', exact: true }).click();
    await expect(worker.getByRole('button', { name: 'Request to join job', exact: true })).toBeVisible();
    await page.goto('/app/people');
    await page.getByRole('button', { name: 'Crew Member', exact: true }).click();
    const person = page.getByRole('dialog', { name: 'Person details' });
    await person.getByText('Manage access', { exact: true }).click();
    await person.getByLabel('Access', { exact: true }).selectOption('suspended');
    await person.getByLabel('Reason for change').fill('Temporary access suspension');
    await person.getByRole('button', { name: 'Save member access' }).click();
    await expect(page.getByRole('heading', { name: 'Crew Member', exact: true })).toHaveCount(0);
    expect((await worker.request.get(`${fixture.base}/jobs`)).status()).toBe(403);
    await worker.reload();
    await expect(worker).toHaveURL(/company-setup/);
  } finally {
    await context.close();
  }
});

test('registration attaches a real photo served through authorized download', async ({ page, browser }) => {
  const fixture = await workspace(page);
  const model = await command(page.request, `${fixture.base}/tool-models`, {
    category_id: fixture.asset.category_id,
    name: 'Hammer drill',
    manufacturer: 'DeWalt',
    model_number: 'DCD996',
  });
  await page.reload(); // Complete external fixture setup before testing the UI's catalog read.
  await page.getByRole('link', { name: 'Add tool', exact: true }).click();
  await page.getByLabel('Tool photo (up to 8 MB)').setInputFiles('e2e/fixtures/hammer-drill.jpg');
  await page.getByLabel('Tool model').selectOption(model.id);
  await page.getByLabel('Starting warehouse').selectOption({ label: 'Main warehouse' });
  await page.getByLabel('Unique asset tag').fill('PHOTO-003');
  await page.getByRole('button', { name: 'Register tool', exact: true }).click();
  await page.getByRole('link', { name: 'Open its custody record' }).click();
  const photo = page.getByRole('link', { name: 'Download registration photo' });
  const href = await photo.getAttribute('href');
  const download = await page.request.get(href!);
  expect(download.status()).toBe(200);
  expect(download.headers()['content-type']).toContain('image/jpeg');
  const anonymous = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  try {
    expect((await anonymous.request.get(href!)).status()).toBe(401);
  } finally {
    await anonymous.close();
  }
  expect((await (await page.request.get(`${fixture.base}/tools?search=PHOTO-003`)).json()).items).toHaveLength(1);
});
