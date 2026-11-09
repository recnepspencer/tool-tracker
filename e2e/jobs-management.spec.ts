import { expect, type Browser, type Page } from '@playwright/test';
import { command, invitedMember, workspace, chooseOption, test } from './support';

for (const role of ['company_admin', 'dispatcher'])
  test(`${role} adds a job, manages its people, archives and restores it`, async ({ page, browser }) => {
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
      await actor.getByRole('button', { name: 'Add job', exact: true }).click();
      let dialog = actor.getByRole('dialog', { name: 'Add job', exact: true });
      await dialog.getByLabel('Job number').fill('J2');
      await dialog.getByLabel('Job name').fill('Riverside lighting');
      await dialog.getByRole('button', { name: 'Add job', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await actor.getByRole('button', { name: 'Open Riverside lighting', exact: true }).click();
      dialog = actor.getByRole('dialog', { name: 'Riverside lighting', exact: true });
      await dialog.getByLabel('Job name').fill('Riverside electrical');
      await dialog.getByRole('button', { name: 'Save job', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await actor.getByLabel('Search jobs').fill('Riverside electrical');
      await expect(actor).toHaveURL(/search=Riverside/);
      await actor.reload();
      await expect(actor.getByLabel('Search jobs')).toHaveValue('Riverside electrical');
      const open = actor.getByRole('button', { name: 'Open Riverside electrical', exact: true });
      await open.click();
      const job = actor.getByRole('dialog', { name: 'Riverside electrical', exact: true });
      const people = job.getByRole('region', { name: 'People', exact: true });
      const assigning = job.getByRole('region', { name: 'Assign a person', exact: true });
      const assign = async (responsibility: string, reason: string) => {
        await chooseOption(assigning, 'Person', member.id);
        await chooseOption(assigning, 'Responsibility', responsibility);
        await assigning.getByLabel('Reason', { exact: true }).fill(reason);
        await assigning.getByRole('button', { name: 'Assign', exact: true }).click();
        await expect(
          people.getByRole('article', { name: `Crew operator ${responsibility}`, exact: true }),
        ).toBeVisible();
      };
      for (const responsibility of ['crew', 'foreman', 'supervisor']) {
        await assign(responsibility, `Appointed as ${responsibility}`);
        // Changing responsibility closes the previous assignment, so only one stays current.
        await expect(people.getByRole('article')).toHaveCount(1);
      }
      const supervisor = people.getByRole('article', { name: 'Crew operator supervisor', exact: true });
      await supervisor.getByRole('button', { name: 'End Crew operator’s assignment', exact: true }).click();
      await supervisor.getByLabel('Reason', { exact: true }).fill('Supervisor work completed');
      await supervisor.getByRole('button', { name: 'End assignment', exact: true }).click();
      await expect(people.getByText('No one is on this job yet.')).toBeVisible();
      await assign('crew', 'Crew work continues');
      await chooseOption(people, 'Assignments', 'history');
      await expect(people.getByRole('combobox', { name: 'Assignments', exact: true })).toHaveText('Assignment history');
      await expect(people.getByRole('article')).toHaveCount(4);
      await expect(people.getByText(/Supervisor work completed/)).toBeVisible();
      await actor.screenshot({ path: `artifacts/jobs-roster-${role}.png`, fullPage: true });
      await actor.keyboard.press('Escape');
      await expect(job).toHaveCount(0);
      await expect(open).toBeFocused();

      // Archiving asks first, then takes everyone off the job.
      await open.click();
      await job.getByRole('button', { name: 'Archive job', exact: true }).click();
      dialog = actor.getByRole('dialog', { name: 'Archive job', exact: true });
      await expect(dialog.getByText(/tool custody/)).toBeVisible();
      await dialog.getByRole('button', { name: 'Archive job', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(actor.getByText('No jobs match this search.')).toBeVisible();
      expect((await (await page.request.get(`${fixture.base}/assignments`)).json()).items).toEqual([]);
      await actor.getByRole('button', { name: 'Show archived jobs', exact: true }).click();
      await expect(actor).toHaveURL(/archived=true/);
      await open.click();
      await job.getByRole('button', { name: 'Restore job', exact: true }).click();
      await expect(job).toHaveCount(0);
      await expect(open).toHaveCount(0);
      await actor.getByRole('button', { name: 'Show active jobs', exact: true }).click();
      await open.click();
      await expect(people.getByText('No one is on this job yet.')).toBeVisible();
      await chooseOption(people, 'Assignments', 'history');
      await expect(people.getByRole('article')).toHaveCount(4);
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
      // Managers find the switch on the job's page; field members get the "My jobs" switch list.
      if (role === 'company_admin')
        await actor.getByRole('button', { name: 'Open Library wiring', exact: true }).click();
      const scope =
        role === 'company_admin' ? actor.getByRole('dialog', { name: 'Library wiring', exact: true }) : actor;
      const membership = scope.getByRole('switch', { name: 'Library wiring', exact: true });
      const onJob = scope.getByText(/^On this job$/);
      if (role === 'company_admin')
        await actor.route(
          `**${fixture.base}/jobs/${fixture.job.id}/participation`,
          async (route) => {
            expect((await route.fetch()).status()).toBe(201);
            await route.abort('connectionreset');
          },
          { times: 1 },
        );
      await membership.click();
      if (role === 'company_admin') {
        await expect(actor.getByRole('alert')).toBeVisible();
        await membership.click();
      }
      await expect(onJob).toBeVisible();
      await expect(membership).toBeChecked();
      await actor.reload();
      await expect(membership).toBeChecked();
      if (role === 'field_member') {
        await actor.setViewportSize({ width: 390, height: 844 });
        await actor.screenshot({ path: 'artifacts/jobs-direct-field-mobile.png', fullPage: true });
        expect(await actor.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      const current = (await (await actor.request.get(`${fixture.base}/assignments`)).json()).items;
      expect(current).toHaveLength(1);
      expect(current[0].responsibility).toBe('crew');
      if (member) expect(current[0].membership_id).toBe(member.id);
      await membership.click();
      await expect(membership).not.toBeChecked();
      await expect(onJob).toHaveCount(0);
      expect((await (await actor.request.get(`${fixture.base}/assignments`)).json()).items).toEqual([]);
      expect(
        (await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json()).items,
      ).toEqual(before);
      if (role === 'field_member') {
        // The field list has no request history view; the completed requests are checked through the API.
        const history = (
          await (await actor.request.get(`${fixture.base}/job-participation-requests?pending=false`)).json()
        ).items;
        expect(history.filter((item: { status: string }) => item.status === 'approved')).toHaveLength(2);
      }
    } finally {
      await context.close();
    }
  });

// Reviewers decide from the participation queue; the requester withdraws from their own job switch.
async function decision(actor: Page, member: string, action: 'approve' | 'reject' | 'withdraw', note: string) {
  if (action === 'withdraw') {
    await actor.getByRole('switch', { name: 'Library wiring', exact: true }).click();
    const dialog = actor.getByRole('dialog', { name: 'Withdraw your request?', exact: true });
    await dialog.getByLabel('Note').fill(note);
    await dialog.getByRole('button', { name: 'Withdraw request', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(actor.getByText('Request pending', { exact: true })).toHaveCount(0);
    return;
  }
  const section = actor.getByRole('region', { name: 'Participation requests', exact: true });
  await section.getByRole('button', { name: new RegExp(`^Review ${member}’s request to`) }).click();
  const dialog = actor.getByRole('dialog', { name: `Review ${member}’s request`, exact: true });
  await dialog.getByLabel('Decision note').fill(note);
  await dialog.getByRole('button', { name: action === 'approve' ? 'Approve' : 'Reject', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  // The requests box only shows while someone is waiting.
  await expect(section).toHaveCount(0);
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
    await expect(membership).toBeChecked();
    // With leaving disabled the switch stays on but cannot be turned off.
    await expect(worker.getByText('Ask a manager to remove you', { exact: true })).toBeVisible();
    await expect(membership).toBeDisabled();
    expect((await (await worker.request.get(`${fixture.base}/assignments`)).json()).items).toHaveLength(1);
    await worker.screenshot({ path: 'artifacts/jobs-leave-managed-mobile.png', fullPage: true });

    policy = await (await page.request.get(`${fixture.base}/job-participation-policy`)).json();
    await command(page.request, `${fixture.base}/job-participation-policy`, {
      expected_revision: policy.revision,
      self_join_mode: 'direct',
      self_leave_mode: 'approval_required',
    });
    await worker.reload();
    await membership.click();
    const asking = worker.getByRole('dialog', { name: 'Request to leave Library wiring', exact: true });
    await asking.getByRole('button', { name: 'Send request', exact: true }).click();
    await expect(asking).toHaveCount(0);
    await expect(worker.getByText('Request pending', { exact: true })).toBeVisible();
    // A request does not end the assignment before the manager approves it.
    expect((await (await worker.request.get(`${fixture.base}/assignments`)).json()).items).toHaveLength(1);
    await page.goto('/app/jobs');
    await decision(page, 'Job operator', 'approve', 'Handover complete');
    await worker.reload();
    await expect(membership).not.toBeChecked();
    expect((await (await worker.request.get(`${fixture.base}/assignments`)).json()).items).toEqual([]);
  } finally {
    await context.close();
  }
});

// A field member asks the role under test to join or leave Library wiring under approval rules.
async function participationScenario(page: Page, browser: Browser, role: string) {
  const fixture = await workspace(page);
  const reviewerContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const workerContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 390, height: 844 },
  });
  const close = async () => {
    await reviewerContext.close();
    await workerContext.close();
  };
  const reviewer = role === 'company_admin' ? page : await reviewerContext.newPage();
  const worker = await workerContext.newPage();
  const [member] = await Promise.all([
    invitedMember(page, worker, fixture.base, 'field_member', 'Approval operator'),
    reviewer !== page ? invitedMember(page, reviewer, fixture.base, role, 'Job reviewer') : undefined,
  ]);
  const policy = await (await page.request.get(`${fixture.base}/job-participation-policy`)).json();
  await command(page.request, `${fixture.base}/job-participation-policy`, {
    expected_revision: policy.revision,
    self_join_mode: 'approval_required',
    self_leave_mode: 'approval_required',
  });
  const custody = async () =>
    (await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json()).items;
  const request = async (intent: 'Join' | 'Leave') => {
    await worker.goto('/app/jobs');
    await worker.getByRole('switch', { name: 'Library wiring', exact: true }).click();
    const asking = worker.getByRole('dialog', {
      name: `Request to ${intent.toLowerCase()} Library wiring`,
      exact: true,
    });
    await asking.getByRole('button', { name: 'Send request', exact: true }).click();
    await expect(asking).toHaveCount(0);
    await expect(worker.getByText('Request pending', { exact: true })).toBeVisible();
    await reviewer.goto('/app/jobs');
  };
  const history = async () => {
    await reviewer.getByRole('button', { name: 'Request history', exact: true }).click();
    await expect(reviewer.getByRole('heading', { name: 'Request history', exact: true })).toBeVisible();
  };
  return {
    fixture,
    reviewer,
    worker,
    member,
    before: await custody(),
    custody,
    request,
    history,
    requests: reviewer.getByRole('region', { name: 'Participation requests', exact: true }),
    close,
  };
}

for (const role of ['company_admin', 'dispatcher']) {
  test(`${role} rejects, sees a withdrawal of, then approves a join request`, async ({ page, browser }) => {
    const { fixture, reviewer, worker, member, before, custody, request, history, requests, close } =
      await participationScenario(page, browser, role);
    try {
      const memberName = 'Approval operator';
      await request('Join');
      await decision(reviewer, memberName, 'reject', 'Join rejected for scheduling');
      await request('Join');
      await decision(worker, memberName, 'withdraw', 'Join withdrawn by employee');
      await request('Join');
      await decision(reviewer, memberName, 'approve', 'Join approved');
      expect((await (await reviewer.request.get(`${fixture.base}/assignments`)).json()).items).toMatchObject([
        { membership_id: member.id },
      ]);
      await history();
      await expect(requests.getByText(/Join approved/)).toBeVisible();
      await expect(requests.getByText(/Join rejected for scheduling/)).toBeVisible();
      expect(await custody()).toEqual(before);
    } finally {
      await close();
    }
  });

  test(`${role} reviews leave requests and cannot approve an obsolete leave target`, async ({ page, browser }) => {
    const { fixture, reviewer, worker, member, before, custody, request, history, requests, close } =
      await participationScenario(page, browser, role);
    try {
      // Start from someone already on the crew; joining is covered on its own.
      await command(page.request, `${fixture.base}/jobs/${fixture.job.id}/assignments`, {
        expected_revision: 1,
        membership_id: member.id,
        responsibility: 'crew',
        reason: 'Already on the crew',
      });
      const memberName = 'Approval operator';
      await request('Leave');
      await decision(reviewer, memberName, 'reject', 'Leave rejected until handover');
      await request('Leave');
      await decision(worker, memberName, 'withdraw', 'Leave withdrawn by employee');
      await request('Leave');
      await reviewer.getByRole('button', { name: 'Open Library wiring', exact: true }).click();
      const roster = reviewer.getByRole('dialog', { name: 'Library wiring', exact: true });
      const assigning = roster.getByRole('region', { name: 'Assign a person', exact: true });
      await chooseOption(assigning, 'Person', member.id);
      await chooseOption(assigning, 'Responsibility', 'foreman');
      await assigning.getByLabel('Reason', { exact: true }).fill('Promoted while leave review pending');
      await assigning.getByRole('button', { name: 'Assign', exact: true }).click();
      await expect(roster.getByRole('article', { name: 'Approval operator foreman', exact: true })).toBeVisible();
      await reviewer.keyboard.press('Escape');
      await expect(roster).toHaveCount(0);
      await expect(requests.getByText(/referenced assignment is no longer current/)).toBeVisible();
      await expect(requests.getByRole('button', { name: /^Approve/ })).toHaveCount(0);
      await requests.getByRole('button', { name: /^Review Approval operator’s request to leave/ }).click();
      await expect(
        reviewer
          .getByRole('dialog', { name: 'Review Approval operator’s request', exact: true })
          .getByRole('button', { name: 'Approve', exact: true }),
      ).toHaveCount(0);
      await reviewer.keyboard.press('Escape');
      await decision(reviewer, memberName, 'reject', 'Obsolete assignment request closed');
      await request('Leave');
      await decision(reviewer, memberName, 'approve', 'Current leave approved');
      expect((await (await reviewer.request.get(`${fixture.base}/assignments`)).json()).items).toEqual([]);
      await history();
      await expect(requests.getByText(/Current leave approved/)).toBeVisible();
      await expect(requests.getByText(/Leave rejected until handover/)).toBeVisible();
      expect(await custody()).toEqual(before);
      await worker.goto('/app/jobs');
      await expect(worker.getByRole('switch', { name: 'Library wiring', exact: true })).not.toBeChecked();
      await expect(worker.getByText('Not on this job', { exact: true })).toBeVisible();
      await worker.screenshot({ path: `artifacts/jobs-participation-${role}-mobile.png`, fullPage: true });
      expect(await worker.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    } finally {
      await close();
    }
  });
}
