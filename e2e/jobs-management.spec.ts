import { test, expect, type Page } from '@playwright/test';
import { command, invitedMember, workspace } from './support';

for (const role of ['company_admin', 'dispatcher'])
  test(`${role} manages project, roster responsibilities, archive and restore`, async ({ page, browser }) => {
    test.setTimeout(150_000);
    const fixture = await workspace(page);
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
    const workerContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
    const actor = role === 'company_admin' ? page : await context.newPage();
    const worker = await workerContext.newPage();
    try {
      if (actor !== page) await invitedMember(page, actor, fixture.base, role, 'Job coordinator');
      const member = await invitedMember(page, worker, fixture.base, 'field_member', 'Crew operator');
      const custodyBefore = (await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json())
        .items;
      await actor.goto('/app/jobs');
      await actor.getByRole('button', { name: 'Add project', exact: true }).click();
      let dialog = actor.getByRole('dialog', { name: 'Add project', exact: true });
      await dialog.getByLabel('Project number').fill('P2');
      await dialog.getByLabel('Project name').fill('Riverside');
      await dialog.getByRole('button', { name: 'Create project', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await actor.getByRole('button', { name: 'Add job', exact: true }).click();
      dialog = actor.getByRole('dialog', { name: 'Add job', exact: true });
      await dialog.getByLabel('Project', { exact: true }).selectOption({ label: 'P2 · Riverside' });
      await dialog.getByLabel('Job number').fill('J2');
      await dialog.getByLabel('Job name').fill('Riverside lighting');
      await dialog.getByRole('button', { name: 'Create job', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await actor.getByRole('button', { name: 'Edit Riverside lighting', exact: true }).click();
      dialog = actor.getByRole('dialog', { name: 'Edit job', exact: true });
      await dialog.getByLabel('Job name').fill('Riverside electrical');
      await dialog.getByRole('button', { name: 'Save job', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await actor.getByLabel('Search jobs').fill('Riverside electrical');
      await actor.reload();
      await expect(actor.getByLabel('Search jobs')).toHaveValue('Riverside electrical');
      await actor.getByRole('button', { name: 'View people on Riverside electrical', exact: true }).click();
      const roster = actor.getByRole('dialog', { name: 'Job details', exact: true });
      const assigning = roster.getByRole('region', { name: 'Assign a person', exact: true });
      for (const responsibility of ['crew', 'foreman', 'supervisor']) {
        await assigning.getByLabel('Person', { exact: true }).selectOption(member.id);
        await assigning.getByLabel('Responsibility').selectOption(responsibility);
        await assigning.getByLabel('Reason', { exact: true }).fill(`Appointed as ${responsibility}`);
        await assigning.getByRole('button', { name: 'Save assignment', exact: true }).click();
        await expect(
          roster.getByRole('article', { name: `Crew operator ${responsibility}`, exact: true }),
        ).toBeVisible();
      }
      const supervisor = roster.getByRole('article', { name: 'Crew operator supervisor', exact: true });
      await supervisor.locator('summary').click();
      await supervisor.getByLabel('Reason', { exact: true }).fill('Supervisor work completed');
      await supervisor.getByRole('button', { name: 'End assignment', exact: true }).click();
      await expect(roster.getByText('No current assignments.')).toBeVisible();
      await assigning.getByLabel('Reason', { exact: true }).fill('Crew work continues');
      await assigning.getByLabel('Responsibility').selectOption('crew');
      await assigning.getByRole('button', { name: 'Save assignment', exact: true }).click();
      await expect(roster.getByRole('article', { name: 'Crew operator crew', exact: true })).toBeVisible();
      await roster.getByLabel('Assignment history').click();
      await expect(roster.getByLabel('Assignment history')).toBeChecked();
      await expect(roster.getByRole('article')).toHaveCount(4);
      await expect(roster.getByText('Supervisor work completed', { exact: true })).toBeVisible();
      await actor.screenshot({ path: `artifacts/jobs-roster-${role}.png`, fullPage: true });
      await actor.keyboard.press('Escape');
      await expect(
        actor.getByRole('button', { name: 'View people on Riverside electrical', exact: true }),
      ).toBeFocused();
      const projectEdit = async (status: string) => {
        await actor.getByRole('button', { name: 'Edit project Riverside', exact: true }).click();
        const form = actor.getByRole('dialog', { name: 'Edit project', exact: true });
        await form.getByLabel('Project status').selectOption(status);
        await form.getByRole('button', { name: 'Save project', exact: true }).click();
        return form;
      };
      dialog = await projectEdit('closed');
      await expect(dialog.getByRole('alert')).toContainText('active jobs');
      await expect(dialog.getByRole('button', { name: 'Load latest values' })).toHaveCount(0);
      await actor.keyboard.press('Escape');
      await actor.getByRole('button', { name: 'Archive Riverside electrical', exact: true }).click();
      dialog = actor.getByRole('dialog', { name: 'Archive job', exact: true });
      await expect(dialog.getByText(/Tool custody|tool custody/)).toBeVisible();
      await dialog.getByRole('button', { name: 'Archive job', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(actor.getByText('No jobs match your search.')).toBeVisible();
      await expect(await projectEdit('closed')).toHaveCount(0);
      await actor.getByLabel('Show archived jobs').click();
      await expect(actor.getByLabel('Show archived jobs')).toBeChecked();
      await actor.getByRole('button', { name: 'Restore Riverside electrical', exact: true }).click();
      dialog = actor.getByRole('dialog', { name: 'Restore job', exact: true });
      await dialog.getByRole('button', { name: 'Restore job', exact: true }).click();
      await expect(dialog.getByRole('alert')).toContainText('Reopen the project');
      await actor.keyboard.press('Escape');
      await expect(await projectEdit('active')).toHaveCount(0);
      await actor.getByRole('button', { name: 'Restore Riverside electrical', exact: true }).click();
      dialog = actor.getByRole('dialog', { name: 'Restore job', exact: true });
      await dialog.getByRole('button', { name: 'Restore job', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await actor.getByLabel('Show archived jobs').click();
      await expect(actor.getByLabel('Show archived jobs')).not.toBeChecked();
      await actor.getByRole('button', { name: 'View people on Riverside electrical', exact: true }).click();
      await roster.getByLabel('Assignment history').click();
      await expect(roster.getByLabel('Assignment history')).not.toBeChecked();
      await expect(roster.getByText('No current assignments.')).toBeVisible();
      await roster.getByLabel('Assignment history').click();
      await expect(roster.getByLabel('Assignment history')).toBeChecked();
      await expect(roster.getByRole('article')).toHaveCount(4);
      expect(
        (await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json()).items,
      ).toEqual(custodyBefore);
    } finally {
      await context.close();
      await workerContext.close();
    }
  });

for (const role of ['company_admin', 'equipment_manager', 'field_member'])
  test(`${role} can join and leave directly while tools stay independent`, async ({ page, browser }) => {
    const fixture = await workspace(page);
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
    const actor = role === 'company_admin' ? page : await context.newPage();
    try {
      const member =
        actor === page ? null : await invitedMember(page, actor, fixture.base, role, 'Participating operator');
      const policy = await (await page.request.get(`${fixture.base}/job-participation-policy`)).json();
      await command(page.request, `${fixture.base}/job-participation-policy`, {
        expected_revision: policy.revision,
        self_join_mode: 'direct',
        self_leave_mode: 'direct',
      });
      const before = (await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json()).items;
      await actor.goto('/app/jobs');
      const row = actor.getByRole('article', { name: 'Library wiring', exact: true });
      if (role === 'company_admin')
        await actor.route(
          `**${fixture.base}/jobs/${fixture.job.id}/participation`,
          async (route) => {
            expect((await route.fetch()).status()).toBe(201);
            await route.abort('connectionreset');
          },
          { times: 1 },
        );
      await row.getByRole('switch', { name: 'Library wiring', exact: true }).click();
      if (role === 'company_admin') {
        await expect(row.getByRole('alert')).toBeVisible();
        await row.getByRole('switch', { name: 'Library wiring', exact: true }).click();
      }
      await expect(row.getByText('On this job · crew', { exact: true })).toBeVisible();
      await expect(row.getByRole('switch', { name: 'Library wiring', exact: true })).toBeChecked();
      await actor.reload();
      await expect(row.getByRole('switch', { name: 'Library wiring', exact: true })).toBeChecked();
      if (role === 'field_member') {
        await actor.setViewportSize({ width: 390, height: 844 });
        await actor.screenshot({ path: 'artifacts/jobs-direct-field-mobile.png', fullPage: true });
        expect(await actor.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      const current = (await (await actor.request.get(`${fixture.base}/assignments`)).json()).items;
      expect(current).toHaveLength(1);
      if (member) expect(current[0].membership_id).toBe(member.id);
      await row.getByRole('switch', { name: 'Library wiring', exact: true }).click();
      await expect(row.getByRole('switch', { name: 'Library wiring', exact: true })).not.toBeChecked();
      expect((await (await actor.request.get(`${fixture.base}/assignments`)).json()).items).toEqual([]);
      expect(
        (await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json()).items,
      ).toEqual(before);
      if (role === 'field_member') {
        await actor.getByRole('button', { name: 'View participation history', exact: true }).click();
        const history = actor.getByRole('region', { name: 'Participation requests', exact: true });
        await expect(history.getByText('approved', { exact: true })).toHaveCount(2);
      }
    } finally {
      await context.close();
    }
  });

async function decision(actor: Page, action: string, note: string) {
  const section = actor.getByRole('region', { name: 'Participation requests', exact: true });
  await section.getByLabel('Decision', { exact: true }).selectOption(action);
  await section.getByLabel('Note', { exact: true }).fill(note);
  await section.getByRole('button', { name: 'Submit decision', exact: true }).click();
  if (action === 'withdraw')
    await expect(actor.getByRole('button', { name: 'View participation history', exact: true })).toBeVisible();
  else await expect(section.getByText('No pending participation requests.')).toBeVisible();
}

test('field job controls follow independent joining and leaving rules', async ({ page, browser }) => {
  const fixture = await workspace(page);
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173', viewport: { width: 390, height: 844 } });
  const worker = await context.newPage();
  try {
    await invitedMember(page, worker, fixture.base, 'field_member', 'Job operator');
    let policy = await (await page.request.get(`${fixture.base}/job-participation-policy`)).json();
    await command(page.request, `${fixture.base}/job-participation-policy`, {
      expected_revision: policy.revision,
      self_join_mode: 'direct',
      self_leave_mode: 'disabled',
    });
    await worker.goto('/app/jobs');
    const membership = worker.getByRole('switch', { name: 'Library wiring', exact: true });
    await expect(membership).not.toBeChecked();
    await membership.focus();
    await worker.keyboard.press('Space');
    await expect(worker.getByText('On this job · crew', { exact: true })).toBeVisible();
    await expect(worker.getByText('Ask a manager to remove you from this job.', { exact: true })).toBeVisible();
    await expect(membership).toHaveCount(0);
    expect((await (await worker.request.get(`${fixture.base}/assignments`)).json()).items).toHaveLength(1);
    await worker.screenshot({ path: 'artifacts/jobs-leave-managed-mobile.png', fullPage: true });

    policy = await (await page.request.get(`${fixture.base}/job-participation-policy`)).json();
    await command(page.request, `${fixture.base}/job-participation-policy`, {
      expected_revision: policy.revision,
      self_join_mode: 'direct',
      self_leave_mode: 'approval_required',
    });
    await worker.reload();
    await worker.getByRole('button', { name: 'Request to leave job', exact: true }).click();
    await expect(worker.getByText('Leave awaiting approval', { exact: true })).toBeVisible();
    // A request does not end the assignment before the manager approves it.
    expect((await (await worker.request.get(`${fixture.base}/assignments`)).json()).items).toHaveLength(1);
    await page.goto('/app/jobs');
    await decision(page, 'approve', 'Handover complete');
    await worker.reload();
    await expect(membership).not.toBeChecked();
    expect((await (await worker.request.get(`${fixture.base}/assignments`)).json()).items).toEqual([]);
  } finally {
    await context.close();
  }
});

for (const role of ['company_admin', 'dispatcher'])
  test(`${role} reviews join/leave decisions and cannot approve an obsolete leave target`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(150_000);
    const fixture = await workspace(page);
    const reviewerContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
    const workerContext = await browser.newContext({
      baseURL: 'http://127.0.0.1:4173',
      viewport: { width: 390, height: 844 },
    });
    const reviewer = role === 'company_admin' ? page : await reviewerContext.newPage();
    const worker = await workerContext.newPage();
    try {
      const member = await invitedMember(page, worker, fixture.base, 'field_member', 'Approval operator');
      if (reviewer !== page) await invitedMember(page, reviewer, fixture.base, role, 'Job reviewer');
      const policy = await (await page.request.get(`${fixture.base}/job-participation-policy`)).json();
      await command(page.request, `${fixture.base}/job-participation-policy`, {
        expected_revision: policy.revision,
        self_join_mode: 'approval_required',
        self_leave_mode: 'approval_required',
      });
      const before = (await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json()).items;
      const request = async (intent: 'Join' | 'Leave') => {
        await worker.goto('/app/jobs');
        await worker.getByRole('button', { name: `Request to ${intent.toLowerCase()} job`, exact: true }).click();
        await expect(worker.getByText(`${intent} awaiting approval`, { exact: true })).toBeVisible();
        await expect(
          worker.getByRole('button', { name: `Request to ${intent.toLowerCase()} job`, exact: true }),
        ).toHaveCount(0);
        await reviewer.goto('/app/jobs');
      };
      await request('Join');
      await decision(reviewer, 'reject', 'Join rejected for scheduling');
      await request('Join');
      await decision(worker, 'withdraw', 'Join withdrawn by employee');
      await request('Join');
      await decision(reviewer, 'approve', 'Join approved');
      await request('Leave');
      await decision(reviewer, 'reject', 'Leave rejected until handover');
      await request('Leave');
      await decision(worker, 'withdraw', 'Leave withdrawn by employee');
      await request('Leave');
      await reviewer.getByRole('button', { name: 'View people on Library wiring', exact: true }).click();
      const roster = reviewer.getByRole('dialog', { name: 'Job details', exact: true });
      const assigning = roster.getByRole('region', { name: 'Assign a person', exact: true });
      await assigning.getByLabel('Person', { exact: true }).selectOption(member.id);
      await assigning.getByLabel('Responsibility').selectOption('foreman');
      await assigning.getByLabel('Reason', { exact: true }).fill('Promoted while leave review pending');
      await assigning.getByRole('button', { name: 'Save assignment', exact: true }).click();
      await expect(roster.getByRole('article', { name: 'Approval operator foreman', exact: true })).toBeVisible();
      await reviewer.keyboard.press('Escape');
      const requests = reviewer.getByRole('region', { name: 'Participation requests', exact: true });
      await expect(requests.getByText(/referenced assignment is no longer current/)).toBeVisible();
      await expect(requests.getByLabel('Decision').getByRole('option', { name: 'Approve', exact: true })).toHaveCount(
        0,
      );
      await decision(reviewer, 'reject', 'Obsolete assignment request closed');
      await request('Leave');
      await decision(reviewer, 'approve', 'Current leave approved');
      expect((await (await reviewer.request.get(`${fixture.base}/assignments`)).json()).items).toEqual([]);
      await reviewer.getByLabel('Include completed participation').click();
      await expect(reviewer.getByLabel('Include completed participation')).toBeChecked();
      await expect(reviewer.getByText('Current leave approved', { exact: true })).toBeVisible();
      await expect(reviewer.getByText('Join rejected for scheduling', { exact: true })).toBeVisible();
      expect(
        (await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json()).items,
      ).toEqual(before);
      await worker.goto('/app/jobs');
      await expect(worker.getByRole('button', { name: 'Request to join job', exact: true })).toBeVisible();
      await worker.screenshot({ path: `artifacts/jobs-participation-${role}-mobile.png`, fullPage: true });
      expect(await worker.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    } finally {
      await reviewerContext.close();
      await workerContext.close();
    }
  });
