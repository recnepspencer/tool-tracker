import { expect, type Page } from '@playwright/test';
import { command, workspace, emailLink, password, chooseOption, signupCode, test } from './support';

const unitRow = (page: Page, tag: string) =>
  page.getByRole('button', { name: `Open Hammer drill, ${tag}`, exact: true });
const details = (page: Page) => page.getByRole('dialog', { name: 'Hammer drill details', exact: true });

test('physical assets remain distinct and list navigation survives refresh', async ({ page }) => {
  await workspace(page);
  await page.getByRole('button', { name: 'Expand Hammer drill, 2 tools' }).click();
  await expect(unitRow(page, 'UNIT-001')).toBeVisible();
  await expect(unitRow(page, 'UNIT-002')).toBeVisible();
  await page.getByLabel('Search inventory', { exact: true }).fill('UNIT-002');
  await expect(unitRow(page, 'UNIT-001')).toHaveCount(0);
  await expect(page).toHaveURL(/search=UNIT-002/);
  await page.reload();
  await expect(page.getByLabel('Search inventory', { exact: true })).toHaveValue('UNIT-002');
  await unitRow(page, 'UNIT-002').click();
  await expect(details(page)).toBeVisible();
  await expect(details(page).getByRole('heading', { name: 'Hammer drill' })).toBeVisible();
  await page.goBack();
  await expect(details(page)).toHaveCount(0);
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
  await unitRow(page, 'UNIT-001').click();
  const reports = page.getByRole('region', { name: 'Open reports', exact: true });
  await page.getByRole('button', { name: 'Mark lost', exact: true }).click();
  const lost = page.getByRole('dialog', { name: 'Mark lost: Hammer drill', exact: true });
  await expect(lost.getByRole('combobox', { name: 'Condition', exact: true })).toHaveText('Lost');
  await lost.getByLabel('Evidence note').fill('Could not locate during stock check');
  await lost.getByRole('button', { name: 'Mark lost', exact: true }).click();
  await expect(lost).toHaveCount(0);
  await expect(reports.getByText('Could not locate during stock check', { exact: true })).toBeVisible();
  await reports.getByRole('button', { name: 'Mark found', exact: true }).click();
  const found = page.getByRole('dialog', { name: 'Mark Hammer drill found', exact: true });
  await found.getByLabel('Where was it found?').fill('Located in secured cabinet');
  await found.getByRole('button', { name: 'Mark found', exact: true }).click();
  await expect(found).toHaveCount(0);
  // The reports section is only shown while a report is open.
  await expect(reports).toHaveCount(0);
  await page.getByRole('button', { name: 'Record service', exact: true }).click();
  const service = page.getByRole('dialog', { name: 'Record service for Hammer drill', exact: true });
  await chooseOption(service, 'Condition', 'damaged');
  await service.getByLabel('Work performed').fill('Inspection found a damaged trigger');
  await service.getByRole('button', { name: 'Save service record', exact: true }).click();
  await expect(service).toHaveCount(0);
  const current = await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}`)).json();
  const other = await (await page.request.get(`${fixture.base}/tools/${fixture.second.id}`)).json();
  expect(current).toMatchObject({ missing: false, serviceability: 'damaged', warehouse_id: fixture.warehouse.id });
  expect(other).toMatchObject({ missing: false, serviceability: 'serviceable', warehouse_id: fixture.warehouse.id });
  await page.getByRole('button', { name: 'Decommission tool', exact: true }).click();
  const decommission = page.getByRole('dialog', { name: 'Decommission Hammer drill', exact: true });
  await chooseOption(decommission, 'Lifecycle', 'retired');
  await decommission.getByLabel('Reason or evidence note').fill('Awaiting repair');
  await decommission.getByRole('button', { name: 'Decommission', exact: true }).click();
  await expect(decommission).toHaveCount(0);
  await expect
    .poll(async () => (await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}`)).json()).lifecycle)
    .toBe('retired');
  await page.getByRole('button', { name: 'Reinstate or dispose', exact: true }).click();
  const reinstate = page.getByRole('dialog', { name: 'Change lifecycle of Hammer drill', exact: true });
  await chooseOption(reinstate, 'Lifecycle', 'active');
  await reinstate.getByLabel('Reason or evidence note').fill('Returned to inventory');
  await reinstate.getByRole('button', { name: 'Update lifecycle', exact: true }).click();
  await expect(reinstate).toHaveCount(0);
  await expect
    .poll(async () => (await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}`)).json()).lifecycle)
    .toBe('active');
  await page.goto('/app/flagged?search=UNIT-001');
  const edit = page
    .getByRole('article')
    .filter({ hasText: 'UNIT-001' })
    .getByRole('link', { name: 'Edit', exact: true });
  await edit.click();
  await expect(page).toHaveURL(new RegExp(`/app/flagged/${fixture.asset.id}\\?action=edit$`));
  await expect(page.getByRole('dialog', { name: 'Edit Hammer drill', exact: true })).toBeVisible();
  // The first Escape closes the edit dialog, the second the tool drawer behind it.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Edit Hammer drill', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/app\/flagged\?search=UNIT-001$/);
  await expect(page.getByRole('heading', { name: 'Damaged & lost', exact: true })).toBeVisible();
  await expect(edit).toBeFocused();
});

test('editing a stale record preserves the draft until the user loads latest values', async ({ page }) => {
  const fixture = await workspace(page);
  await page.getByRole('button', { name: 'Expand Hammer drill, 2 tools' }).click();
  await unitRow(page, 'UNIT-001').click();
  await details(page).getByRole('button', { name: 'Edit', exact: true }).click();
  const section = page.getByRole('dialog', { name: 'Edit Hammer drill', exact: true });
  await section.getByLabel('Serial number', { exact: true }).fill('LOCAL-DRAFT');
  const current = await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}`)).json();
  await command(page.request, `${fixture.base}/tools/${fixture.asset.id}/update`, {
    expected_revision: current.revision,
    serial_number: 'OTHER-EDITOR',
  });
  await section.getByRole('button', { name: 'Save changes' }).click();
  await expect(section.getByRole('alert')).toBeVisible();
  await expect(section.getByLabel('Serial number', { exact: true })).toHaveValue('LOCAL-DRAFT');
  await section.getByRole('button', { name: 'Load latest values' }).click();
  await expect(section.getByLabel('Serial number', { exact: true })).toHaveValue('OTHER-EDITOR');
  await section.getByLabel('Serial number', { exact: true }).fill('REVIEWED-VALUE');
  await section.getByRole('button', { name: 'Save changes' }).click();
  await expect(section).toHaveCount(0);
  await expect
    .poll(
      async () => (await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}`)).json()).serial_number,
    )
    .toBe('REVIEWED-VALUE');
});

test('company switching isolates inventory and policy changes survive reload', async ({ page }) => {
  const fixture = await workspace(page);
  // Registration starts off; turn it on so switching it off in the UI is a real change.
  const policy = await (await page.request.get(`${fixture.base}/tool-registration-policy`)).json();
  await command(page.request, `${fixture.base}/tool-registration-policy`, {
    expected_revision: policy.revision,
    employee_tool_creation_enabled: true,
  });
  await page.goto('/app/settings');
  const registration = page.getByRole('region', { name: 'Field inventory collection', exact: true });
  const registrationSwitch = registration.getByRole('switch', { name: 'Collect existing field equipment' });
  await expect(registrationSwitch).toHaveAttribute('aria-checked', 'true');
  await registrationSwitch.click();
  await expect(registrationSwitch).toHaveAttribute('aria-checked', 'false');
  await expect
    .poll(
      async () =>
        (await (await page.request.get(`${fixture.base}/tool-registration-policy`)).json())
          .employee_tool_creation_enabled,
    )
    .toBe(false);
  await page.reload();
  await expect(registrationSwitch).toHaveAttribute('aria-checked', 'false');
  const jobs = page.getByRole('region', { name: 'Job participation', exact: true });
  await chooseOption(jobs, 'Employees joining jobs', 'approval_required');
  await chooseOption(jobs, 'Employees leaving jobs', 'disabled');
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
    signup_code: signupCode(),
  });
  await page.reload();
  const account = page.getByRole('dialog', { name: 'Workspace Owner', exact: true });
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await chooseOption(account, 'Workspace', second.id);
  await expect(page.getByRole('heading', { level: 1, name: 'Queue', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Inventory', exact: true }).click();
  await expect(page.getByText('No tools match this inventory view.')).toBeVisible();
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await chooseOption(account, 'Workspace', fixture.company.id);
  await expect(page.getByRole('heading', { level: 1, name: 'Queue', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Inventory', exact: true }).click();
  await page.getByRole('button', { name: 'Expand Hammer drill, 2 tools' }).click();
  await expect(unitRow(page, 'UNIT-001')).toBeVisible();
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
    await command(worker.request, '/api/auth/signup', {
      email,
      name: 'Crew Member',
      invitation_token: invitation.token,
    });
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
    await expect(worker.getByText(/Field inventory collection is closed/)).toBeVisible();
    await worker.goto('/app/jobs');
    const membership = worker.getByRole('switch', { name: 'Library wiring', exact: true });
    await membership.click();
    const asking = worker.getByRole('dialog', { name: 'Request to join Library wiring', exact: true });
    await asking.getByRole('button', { name: 'Send request', exact: true }).click();
    await expect(asking).toHaveCount(0);
    await expect(worker.getByText('Request pending', { exact: true })).toBeVisible();
    await page.goto('/app/jobs');
    const requests = page.getByRole('region', { name: 'Participation requests' });
    await requests.getByRole('button', { name: 'Approve Crew Member’s request', exact: true }).click();
    await expect(requests.getByText('No one is waiting on a decision.')).toBeVisible();
    await worker.reload();
    await expect(membership).toBeChecked();
    // Leaving is direct under this policy.
    await membership.click();
    await expect(membership).not.toBeChecked();
    await expect(worker.getByRole('dialog')).toHaveCount(0);
    await page.goto('/app/people');
    await page.getByRole('button', { name: 'Open Crew Member', exact: true }).click();
    const person = page.getByRole('dialog', { name: 'Person details for Crew Member', exact: true });
    await person.getByLabel('Access change reason').fill('Temporary access suspension');
    await person.getByRole('button', { name: 'Suspend', exact: true }).click();
    await expect(person.getByText('Suspended', { exact: true })).toBeVisible();
    await expect(person.getByLabel('Access change reason')).toHaveValue('');
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
  await page.getByLabel('Choose a tool photo', { exact: true }).setInputFiles('e2e/fixtures/hammer-drill.jpg');
  await chooseOption(page, 'Tool type', model.id);
  await chooseOption(page, 'Home warehouse', fixture.warehouse.id);
  await page.getByLabel('Asset tag', { exact: true }).fill('PHOTO-003');
  await page.getByRole('button', { name: 'Add tool', exact: true }).click();
  // The new tool's record opens on its own after registration.
  const photo = details(page).getByRole('link', { name: 'View photo', exact: true });
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
