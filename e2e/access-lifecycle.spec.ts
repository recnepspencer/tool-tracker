import { test, expect, type Page } from '@playwright/test';
import { command, invitedMember, workspace, emailLink, password } from './support';

async function issue(
  owner: Page,
  receiver: Page,
  fixture: Awaited<ReturnType<typeof workspace>>,
  membershipId: string,
) {
  const handoff = await command(owner.request, `${fixture.base}/tools/${fixture.asset.id}/handoffs`, {
    expected_revision: fixture.asset.revision,
    request_key: crypto.randomUUID(),
    destination_membership_id: membershipId,
  });
  await command(receiver.request, `${fixture.base}/handoffs/${handoff.id}/accept`, {
    expected_revision: handoff.revision,
  });
}

test('an open equipment page loses revoked controls and gains combined roles through real access refresh', async ({
  page,
  browser,
}) => {
  const fixture = await workspace(page);
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const actor = await context.newPage();
  try {
    const member = await invitedMember(page, actor, fixture.base, 'equipment_manager', 'Changing operator');
    await actor.goto(`/app/tools/${fixture.asset.id}?action=manage`);
    const metadata = actor.getByRole('region', { name: 'Asset information', exact: true });
    await metadata.getByLabel('Serial number', { exact: true }).fill('REVOKED-DRAFT');
    await command(page.request, `${fixture.base}/people/${member.id}/update`, {
      expected_revision: 1,
      access_state: 'active',
      roles: ['estimator'],
      reason: 'Move to estimating',
    });
    await metadata.getByRole('button', { name: 'Update serial number', exact: true }).click();
    await expect(actor.getByText('Your company permissions do not allow access to this page.')).toBeVisible();
    await expect(actor.getByRole('dialog', { name: 'Tool details', exact: true })).toHaveCount(0);
    await expect(actor.getByRole('link', { name: 'Inventory', exact: true })).toHaveCount(0);
    expect(
      (await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}`)).json()).serial_number,
    ).toBeNull();
    await actor.getByRole('button', { name: 'Open navigation', exact: true }).click();
    await actor.getByRole('dialog', { name: 'Navigation' }).getByRole('link', { name: 'Jobs', exact: true }).click();
    await expect(actor.getByRole('heading', { name: 'Jobs', exact: true })).toBeVisible();
    await expect(actor.getByRole('button', { name: 'Add job', exact: true })).toHaveCount(0);
    await command(page.request, `${fixture.base}/people/${member.id}/update`, {
      expected_revision: 2,
      access_state: 'active',
      roles: ['dispatcher', 'field_member'],
      reason: 'Coordinate work and carry tools',
    });
    await actor.getByRole('button', { name: 'Open navigation', exact: true }).click();
    await actor
      .getByRole('dialog', { name: 'Navigation' })
      .getByRole('button', { name: 'Refresh access', exact: true })
      .click();
    await expect(
      actor.getByRole('dialog', { name: 'Navigation' }).getByRole('link', { name: 'Inventory', exact: true }),
    ).toBeVisible();
    await expect(
      actor.getByRole('dialog', { name: 'Navigation' }).getByText('Access refreshed.', { exact: true }),
    ).toBeVisible();
    await actor.keyboard.press('Escape');
    await expect(actor.getByRole('button', { name: 'Add job', exact: true })).toBeVisible();
    const own = (await (await actor.request.get('/api/me')).json()).memberships[0];
    expect(own.capabilities).toEqual(expect.arrayContaining(['jobs.assign', 'tools.transfer']));
    expect(own.capabilities).not.toContain('tools.manage');
  } finally {
    await context.close();
  }
});

test('offboarding closes jobs, keeps named custody and reinstates the same employee without reviving assignments', async ({
  page,
  browser,
}) => {
  const fixture = await workspace(page);
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const worker = await context.newPage();
  try {
    const member = await invitedMember(page, worker, fixture.base, 'field_member', 'Returning employee');
    await issue(page, worker, fixture, member.id);
    const assignment = await command(page.request, `${fixture.base}/jobs/${fixture.job.id}/assignments`, {
      expected_revision: 1,
      membership_id: member.id,
      responsibility: 'foreman',
      reason: 'Lead the work',
    });
    const policy = await (await page.request.get(`${fixture.base}/job-participation-policy`)).json();
    await command(page.request, `${fixture.base}/job-participation-policy`, {
      expected_revision: policy.revision,
      self_join_mode: 'direct',
      self_leave_mode: 'direct',
    });
    const before = (await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json()).items;
    await worker.goto('/app/jobs');
    await expect(worker.getByRole('switch', { name: 'Library wiring', exact: true })).toBeChecked();
    await page.goto('/app/people');
    await page.getByRole('button', { name: 'Returning employee', exact: true }).click();
    let person = page.getByRole('dialog', { name: 'Person details', exact: true });
    await person.getByText('Manage access', { exact: true }).click();
    await person.getByLabel('Access', { exact: true }).selectOption('disabled');
    await person.getByLabel('End employment and current job assignments').check();
    await person.getByLabel('Reason for change').fill('Employment ended with tool accountability retained');
    await person.getByRole('button', { name: 'Save member access', exact: true }).click();
    await expect(person).toHaveCount(0);
    await worker.getByRole('switch', { name: 'Library wiring', exact: true }).click();
    await expect(worker).toHaveURL(/company-setup/);
    await expect(worker.getByRole('button', { name: 'Refresh access', exact: true })).toBeVisible();
    expect((await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json()).items).toEqual(
      before,
    );
    await page.getByLabel('Include suspended and former employees').click();
    await expect(page.getByLabel('Include suspended and former employees')).toBeChecked();
    await page.getByRole('button', { name: 'Returning employee', exact: true }).click();
    person = page.getByRole('dialog', { name: 'Person details', exact: true });
    await person.getByText('Manage access', { exact: true }).click();
    await person.getByLabel('Access', { exact: true }).selectOption('active');
    await person.getByLabel('End employment and current job assignments').uncheck();
    await person.getByLabel('Reason for change').fill('Employee rehired');
    await person.getByRole('button', { name: 'Save member access', exact: true }).click();
    await expect(person).toHaveCount(0);
    await worker.getByRole('button', { name: 'Refresh access', exact: true }).click();
    await expect(worker.getByRole('heading', { name: 'My tools', exact: true })).toBeVisible();
    await expect(worker.getByRole('link', { name: 'UNIT-001 Hammer drill', exact: true })).toBeVisible();
    expect((await (await worker.request.get(`${fixture.base}/assignments`)).json()).items).toEqual([]);
    const historical = (await (await worker.request.get(`${fixture.base}/assignments?current=false`)).json()).items;
    expect(historical[0]).toMatchObject({
      id: assignment.id,
      member_name: 'Returning employee',
      end_reason: 'Employment ended with tool accountability retained',
    });
    await page.goto(`/app/jobs?job=${fixture.job.id}&history=true`);
    const roster = page.getByRole('dialog', { name: 'Job details', exact: true });
    await expect(roster.getByRole('article', { name: 'Returning employee foreman', exact: true })).toBeVisible();
    await page.screenshot({ path: 'artifacts/jobs-rehired-history.png', fullPage: true });
    await worker.goto('/app/jobs');
    await worker.getByRole('switch', { name: 'Library wiring', exact: true }).click();
    await expect(worker.getByRole('switch', { name: 'Library wiring', exact: true })).toBeChecked();
    const current = (await (await worker.request.get(`${fixture.base}/assignments`)).json()).items;
    expect(current[0].id).not.toBe(assignment.id);
    expect(current[0].responsibility).toBe('crew');
    expect((await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json()).items).toEqual(
      before,
    );
  } finally {
    await context.close();
  }
});

test('revoking a receiving warehouse grant removes an open receipt action without moving custody', async ({
  page,
  browser,
}) => {
  const fixture = await workspace(page);
  const holderContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const managerContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const holder = await holderContext.newPage();
  const manager = await managerContext.newPage();
  try {
    const employee = await invitedMember(page, holder, fixture.base, 'field_member', 'Tool operator');
    const receiver = await invitedMember(page, manager, fixture.base, 'field_member', 'Warehouse receiver');
    await issue(page, holder, fixture, employee.id);
    const grant = await command(page.request, `${fixture.base}/warehouses/${fixture.warehouse.id}/authority`, {
      expected_revision: 1,
      membership_id: receiver.id,
      enabled: true,
    });
    const tool = await (await holder.request.get(`${fixture.base}/tools/${fixture.asset.id}`)).json();
    await command(holder.request, `${fixture.base}/tools/${fixture.asset.id}/handoffs`, {
      expected_revision: tool.revision,
      request_key: crypto.randomUUID(),
      destination_warehouse_id: fixture.warehouse.id,
    });
    await manager.goto('/app/operations');
    await manager.getByRole('button', { name: 'Review handoff', exact: true }).click();
    const review = manager.getByRole('dialog', { name: 'Review handoff', exact: true });
    await review.getByLabel('Decision').selectOption('accept');
    await command(page.request, `${fixture.base}/warehouses/${fixture.warehouse.id}/authority`, {
      expected_revision: grant.revision,
      membership_id: receiver.id,
      enabled: false,
    });
    await review.getByRole('button', { name: 'Confirm handoff decision', exact: true }).click();
    await expect(review).toHaveCount(0);
    await expect(manager.getByText('No handoffs to review.')).toBeVisible();
    expect((await (await manager.request.get('/api/me')).json()).memberships[0].managed_warehouse_ids).toEqual([]);
    expect(
      (await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}`)).json()).holder_membership_id,
    ).toBe(employee.id);
  } finally {
    await holderContext.close();
    await managerContext.close();
  }
});

test('company rules changed mid-draft refresh disabled participation and registration controls', async ({
  page,
  browser,
}) => {
  const fixture = await workspace(page);
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const actor = await context.newPage();
  try {
    await invitedMember(page, actor, fixture.base, 'field_member', 'Employee operator');
    let policy = await (await page.request.get(`${fixture.base}/job-participation-policy`)).json();
    await command(page.request, `${fixture.base}/job-participation-policy`, {
      expected_revision: policy.revision,
      self_join_mode: 'direct',
      self_leave_mode: 'direct',
    });
    await actor.goto('/app/jobs');
    await expect(actor.getByRole('switch', { name: 'Library wiring', exact: true })).toBeVisible();
    policy = await (await page.request.get(`${fixture.base}/job-participation-policy`)).json();
    await command(page.request, `${fixture.base}/job-participation-policy`, {
      expected_revision: policy.revision,
      self_join_mode: 'disabled',
      self_leave_mode: 'approval_required',
    });
    await actor.getByRole('switch', { name: 'Library wiring', exact: true }).click();
    await expect(actor.getByRole('switch', { name: 'Library wiring', exact: true })).toHaveCount(0);
    await expect(actor.getByRole('heading', { name: 'My jobs', exact: true })).toBeVisible();
    await expect(actor.getByText('Ask a manager to add you to this job.', { exact: true })).toBeVisible();
    expect((await (await actor.request.get(`${fixture.base}/assignments`)).json()).items).toEqual([]);
    const registration = await (await page.request.get(`${fixture.base}/tool-registration-policy`)).json();
    if (!registration.employee_tool_creation_enabled)
      await command(page.request, `${fixture.base}/tool-registration-policy`, {
        expected_revision: registration.revision,
        employee_tool_creation_enabled: true,
      });
    await actor.goto('/app/tools/new');
    await actor.getByRole('button', { name: 'Continue without a photo' }).click();
    await actor.getByLabel('Tool model').selectOption(fixture.asset.tool_model_id);
    await actor.getByLabel('Starting warehouse').selectOption(fixture.warehouse.id);
    await actor.getByLabel('Unique asset tag').fill('DENIED-NEW-UNIT');
    const latest = await (await page.request.get(`${fixture.base}/tool-registration-policy`)).json();
    await command(page.request, `${fixture.base}/tool-registration-policy`, {
      expected_revision: latest.revision,
      employee_tool_creation_enabled: false,
    });
    await actor.getByRole('button', { name: 'Register tool', exact: true }).click();
    await expect(actor.getByText(/Employee tool registration is disabled by your company/)).toBeVisible();
    expect((await (await page.request.get(`${fixture.base}/tools?search=DENIED-NEW-UNIT`)).json()).items).toEqual([]);
    await actor.keyboard.press('Escape');
    await expect(actor.getByRole('dialog', { name: 'Add a tool', exact: true })).toHaveCount(0);
    await expect(actor.getByRole('link', { name: 'Add tool', exact: true })).toHaveCount(0);
    await actor.getByRole('button', { name: 'Open navigation', exact: true }).click();
    await expect(
      actor.getByRole('dialog', { name: 'Navigation' }).getByRole('link', { name: 'Add tool', exact: true }),
    ).toHaveCount(0);
    await actor.keyboard.press('Escape');
    await page.goto('/app/tools');
    await expect(page.getByRole('link', { name: 'Add tool', exact: true })).toBeVisible();
    await command(page.request, `${fixture.base}/tool-registration-policy`, {
      expected_revision: latest.revision + 1,
      employee_tool_creation_enabled: true,
    });
    await actor.reload();
    await expect(actor.getByRole('link', { name: 'Add tool', exact: true })).toBeVisible();
    await actor.getByRole('link', { name: 'Add tool', exact: true }).click();
    await expect(actor.getByRole('button', { name: 'Continue without a photo' })).toBeVisible();
  } finally {
    await context.close();
  }
});

test('cross-tab sign-out clears private data and sign-in restores the filtered destination', async ({
  page,
  browser,
}) => {
  const fixture = await workspace(page);
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const first = await context.newPage();
  await invitedMember(page, first, fixture.base, 'field_member', 'Shared session operator');
  const email = (await (await first.request.get('/api/me')).json()).email;
  const second = await context.newPage();
  try {
    await first.goto('/app/mine');
    await second.goto('/app/tools?search=UNIT-001');
    await expect(second.getByRole('link', { name: 'UNIT-001 Hammer drill', exact: true })).toBeVisible();
    await first.getByRole('button', { name: 'Open navigation', exact: true }).click();
    await first.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(second.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
    await expect(second.getByText('UNIT-001', { exact: false })).toHaveCount(0);
    expect(new URL(second.url()).searchParams.get('next')).toBe('/app/tools?search=UNIT-001');
    await first.getByLabel('Email address', { exact: true }).fill(email);
    await first.getByLabel('Password', { exact: true }).fill(password);
    await first.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(second).toHaveURL(/\/app\/tools\?search=UNIT-001$/);
    await expect(second.getByRole('link', { name: 'UNIT-001 Hammer drill', exact: true })).toBeVisible();
    await expect(second.getByRole('link', { name: 'UNIT-002 Hammer drill', exact: true })).toHaveCount(0);
    expect((await second.request.get(`${fixture.base}/tools`)).status()).toBe(200);
  } finally {
    await context.close();
  }
});

test('password recovery revokes a different browser session on its next private read', async ({ page, browser }) => {
  const fixture = await workspace(page);
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const worker = await context.newPage();
  const recovery = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const reset = await recovery.newPage();
  try {
    await invitedMember(page, worker, fixture.base, 'field_member', 'Recovery operator');
    const email = (await (await worker.request.get('/api/me')).json()).email;
    await worker.goto('/app/checkout');
    await reset.goto('/forgot-password');
    await reset.getByLabel('Email address', { exact: true }).fill(email);
    await reset.getByRole('button', { name: 'Send reset link', exact: true }).click();
    await reset.goto(await emailLink(email, '/reset-password'));
    await reset.getByLabel('New password', { exact: true }).fill(password + '-changed');
    await reset.getByLabel('Confirm password', { exact: true }).fill(password + '-changed');
    await reset.getByRole('button', { name: 'Update password', exact: true }).click();
    await expect(reset.getByText('Your password has been updated.', { exact: false })).toBeVisible();
    expect((await worker.request.get(`${fixture.base}/jobs`)).status()).toBe(401);
    if (await worker.getByRole('button', { name: 'Open navigation', exact: true }).count()) {
      await worker.getByRole('button', { name: 'Open navigation', exact: true }).click();
      await worker
        .getByRole('dialog', { name: 'Navigation' })
        .getByRole('link', { name: 'Activity', exact: true })
        .click();
    }
    await expect(worker.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
    await expect(worker.getByRole('link', { name: /UNIT-001/ })).toHaveCount(0);
    await worker.getByLabel('Email address', { exact: true }).fill(email);
    await worker.getByLabel('Password', { exact: true }).fill(password);
    await worker.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(worker.getByRole('alert')).toBeVisible();
    const next = new URL(worker.url()).searchParams.get('next');
    await worker.getByLabel('Password', { exact: true }).fill(password + '-changed');
    await worker.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(worker).toHaveURL(new URL(next ?? '/app', 'http://127.0.0.1:4173').href);
  } finally {
    await context.close();
    await recovery.close();
  }
});
