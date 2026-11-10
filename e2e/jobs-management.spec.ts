import { expect, type Browser, type Locator, type Page } from '@playwright/test';
import { command, invitedMember, workspace, test } from './support';

// Ticks or unticks people in a job's checklist, then saves them all at once.
async function staff(actor: Page, job: string, changes: Record<string, boolean>) {
  await actor
    .getByRole('dialog', { name: job, exact: true })
    .getByRole('button', { name: 'Edit people', exact: true })
    .click();
  const staffing = actor.getByRole('dialog', { name: `People on ${job}`, exact: true });
  for (const [name, on] of Object.entries(changes)) {
    const box = staffing.getByRole('checkbox', { name, exact: true });
    await (on ? box.check() : box.uncheck());
  }
  await staffing.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(staffing).toHaveCount(0);
}

for (const role of ['admin', 'manager'])
  test(`${role} adds a job, puts people on it in one save, archives and restores it`, async ({ page, browser }) => {
    const fixture = await workspace(page);
    const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext({ baseURL: 'http://127.0.0.1:4173' })));
    const [actorPage, crewPage, secondPage] = await Promise.all(contexts.map((context) => context.newPage()));
    const actor = role === 'admin' ? page : actorPage;
    try {
      const [crew] = await Promise.all([
        invitedMember(page, crewPage, fixture.base, 'foreman', 'Crew operator'),
        invitedMember(page, secondPage, fixture.base, 'foreman', 'Second operator'),
        actor !== page ? invitedMember(page, actor, fixture.base, role, 'Job coordinator') : undefined,
      ]);
      const custodyBefore = (await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json())
        .items;
      await actor.goto('/app/jobs');
      await actor.getByRole('button', { name: 'Add job', exact: true }).click();
      const adding = actor.getByRole('dialog', { name: 'Add job', exact: true });
      await adding.getByLabel('Job name').fill('Riverside lighting');
      await adding.getByRole('button', { name: 'Add job', exact: true }).click();
      await expect(adding).toHaveCount(0);

      // A job opens on its people; renaming lives under Details.
      await actor.getByRole('button', { name: 'Open Riverside lighting', exact: true }).click();
      let job = actor.getByRole('dialog', { name: 'Riverside lighting', exact: true });
      await expect(job.getByRole('tab', { name: 'People', exact: true })).toHaveAttribute('aria-selected', 'true');
      await job.getByRole('tab', { name: 'Details', exact: true }).click();
      await job.getByLabel('Job name').fill('Riverside electrical');
      await job.getByRole('button', { name: 'Save name', exact: true }).click();
      job = actor.getByRole('dialog', { name: 'Riverside electrical', exact: true });
      await expect(job.getByRole('heading', { name: 'Riverside electrical', exact: true })).toBeVisible();
      await actor.keyboard.press('Escape');
      await expect(job).toHaveCount(0);

      await actor.getByLabel('Search jobs').fill('Riverside electrical');
      await expect(actor).toHaveURL(/search=Riverside/);
      await actor.reload();
      await expect(actor.getByLabel('Search jobs')).toHaveValue('Riverside electrical');
      const open = actor.getByRole('button', { name: 'Open Riverside electrical', exact: true });
      await open.click();
      const onJob = job.getByRole('list', { name: 'Who’s on this job', exact: true });
      await expect(job.getByText('No one is on this job yet.')).toBeVisible();

      // One save puts two people on; a second takes one of them off again.
      await staff(actor, 'Riverside electrical', { 'Crew operator': true, 'Second operator': true });
      await expect(onJob.getByRole('listitem')).toHaveCount(2);
      await job.getByRole('button', { name: 'Edit people', exact: true }).click();
      const staffing = actor.getByRole('dialog', { name: 'People on Riverside electrical', exact: true });
      await staffing.getByLabel('Search people').fill('second');
      await expect(staffing.getByRole('checkbox')).toHaveCount(1);
      await staffing.getByRole('checkbox', { name: 'Second operator', exact: true }).uncheck();
      await expect(staffing.getByText('1 to take off', { exact: true })).toBeVisible();
      await actor.screenshot({ path: `artifacts/jobs-staffing-${role}.png`, fullPage: true });
      await staffing.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(staffing).toHaveCount(0);
      await expect(onJob.getByRole('listitem')).toHaveCount(1);
      await expect(onJob.getByText('Crew operator', { exact: true })).toBeVisible();
      expect((await (await page.request.get(`${fixture.base}/assignments`)).json()).items).toMatchObject([
        { membership_id: crew.id },
      ]);
      await job.getByRole('button', { name: 'Show past people', exact: true }).click();
      await expect(actor).toHaveURL(/history=true/);
      const past = job.getByRole('list', { name: 'Past people', exact: true });
      await expect(past.getByText('Second operator', { exact: true })).toBeVisible();
      await expect(past.getByText(/^Taken off by /)).toBeVisible();
      await actor.screenshot({ path: `artifacts/jobs-roster-${role}.png`, fullPage: true });
      await actor.keyboard.press('Escape');
      await expect(job).toHaveCount(0);
      await expect(open).toBeFocused();

      // Archiving asks first, then takes everyone off the job.
      await open.click();
      await job.getByRole('tab', { name: 'Details', exact: true }).click();
      await job.getByRole('button', { name: 'Archive job', exact: true }).click();
      const archiving = actor.getByRole('dialog', { name: 'Archive job', exact: true });
      await expect(archiving.getByText(/tool custody/)).toBeVisible();
      await archiving.getByRole('button', { name: 'Archive job', exact: true }).click();
      await expect(archiving).toHaveCount(0);
      await expect(job).toHaveCount(0);
      await expect(actor.getByText('No jobs match this search.')).toBeVisible();
      expect((await (await page.request.get(`${fixture.base}/assignments`)).json()).items).toEqual([]);
      await actor.getByRole('button', { name: 'Show archived jobs', exact: true }).click();
      await expect(actor).toHaveURL(/archived=true/);
      await open.click();
      await expect(job.getByRole('button', { name: 'Edit people', exact: true })).toHaveCount(0);
      await job.getByRole('tab', { name: 'Details', exact: true }).click();
      await job.getByRole('button', { name: 'Restore job', exact: true }).click();
      await expect(job).toHaveCount(0);
      await expect(open).toHaveCount(0);
      await actor.getByRole('button', { name: 'Show active jobs', exact: true }).click();
      await open.click();
      await expect(job.getByText('No one is on this job yet.')).toBeVisible();
      await job.getByRole('button', { name: 'Show past people', exact: true }).click();
      await expect(past.getByRole('listitem')).toHaveCount(2);
      expect(
        (await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json()).items,
      ).toEqual(custodyBefore);
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });

for (const role of ['admin', 'manager', 'foreman'])
  test(`${role} can join and leave directly while tools stay independent`, async ({ page, browser }) => {
    const fixture = await workspace(page);
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
    const actor = role === 'admin' ? page : await context.newPage();
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
      // Managers switch the Jobs page to "My jobs"; a foreman's Jobs page is only that list.
      if (role === 'foreman') await expect(actor.getByRole('heading', { name: 'My jobs', exact: true })).toBeVisible();
      else {
        await actor.getByRole('tab', { name: 'My jobs', exact: true }).click();
        await expect(actor).toHaveURL(/view=mine/);
      }
      const membership = actor.getByRole('switch', { name: 'Library wiring', exact: true });
      if (role === 'admin')
        await actor.route(
          `**${fixture.base}/jobs/${fixture.job.id}/participation`,
          async (route) => {
            expect((await route.fetch()).status()).toBe(201);
            await route.abort('connectionreset');
          },
          { times: 1 },
        );
      await membership.click();
      if (role === 'admin') {
        // The join reached the server but the answer was lost; the retry reuses its request key.
        await expect(actor.getByRole('alert')).toBeVisible();
        await expect(membership).not.toBeChecked();
        await membership.click();
      }
      await expect(actor.getByText('Joined Library wiring', { exact: true })).toHaveCount(1);
      await expect(membership).toBeChecked();
      await actor.reload();
      await expect(membership).toBeChecked();
      if (role === 'foreman') {
        await actor.setViewportSize({ width: 375, height: 812 });
        await actor.screenshot({ path: 'artifacts/jobs-direct-field-mobile.png', fullPage: true });
        expect(await actor.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      const current = (await (await actor.request.get(`${fixture.base}/assignments`)).json()).items;
      expect(current).toHaveLength(1);
      if (member) expect(current[0].membership_id).toBe(member.id);
      await membership.click();
      await expect(membership).not.toBeChecked();
      await expect(actor.getByText('Left Library wiring', { exact: true })).toHaveCount(1);
      expect((await (await actor.request.get(`${fixture.base}/assignments`)).json()).items).toEqual([]);
      expect(
        (await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json()).items,
      ).toEqual(before);
      if (role === 'foreman') {
        // The foreman's list has no request history view; the completed requests are checked through the API.
        const history = (
          await (await actor.request.get(`${fixture.base}/job-participation-requests?pending=false`)).json()
        ).items;
        expect(history.filter((item: { status: string }) => item.status === 'approved')).toHaveLength(2);
      }
    } finally {
      await context.close();
    }
  });

// Reviewers decide from the requests section; the requester cancels from their own job row.
async function decision(actor: Page, member: string, action: 'approve' | 'reject' | 'withdraw', note = '') {
  if (action === 'withdraw') {
    await actor.getByRole('button', { name: 'Cancel your request for Library wiring', exact: true }).click();
    await expect(actor.getByText('Requested', { exact: true })).toHaveCount(0);
    return;
  }
  const section = actor.getByRole('region', { name: 'Join and leave requests', exact: true });
  await section.getByRole('button', { name: new RegExp(`^Review ${member}’s request to`) }).click();
  const dialog = actor.getByRole('dialog', { name: `Review ${member}’s request`, exact: true });
  await dialog.getByLabel('Decision note').fill(note);
  await dialog.getByRole('button', { name: action === 'approve' ? 'Approve' : 'Reject', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  // The requests section only shows while someone is waiting.
  await expect(section).toHaveCount(0);
}

test('foreman job rows follow independent joining and leaving rules', async ({ page, browser }) => {
  const fixture = await workspace(page);
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173', viewport: { width: 375, height: 812 } });
  const worker = await context.newPage();
  try {
    await invitedMember(page, worker, fixture.base, 'foreman', 'Job operator');
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
    // With leaving disabled the row turns into a plain "On this job" mark and says who to ask.
    const fixed = worker.getByRole('group', { name: 'Library wiring, you’re on this job', exact: true });
    await expect(fixed.getByText('On this job', { exact: true })).toBeVisible();
    await expect(membership).toHaveCount(0);
    await expect(worker.getByText('To come off a job, ask a manager.', { exact: true })).toBeVisible();
    expect((await (await worker.request.get(`${fixture.base}/assignments`)).json()).items).toHaveLength(1);
    await worker.screenshot({ path: 'artifacts/jobs-leave-managed-mobile.png', fullPage: true });

    policy = await (await page.request.get(`${fixture.base}/job-participation-policy`)).json();
    await command(page.request, `${fixture.base}/job-participation-policy`, {
      expected_revision: policy.revision,
      self_join_mode: 'direct',
      self_leave_mode: 'approval_required',
    });
    await worker.reload();
    await worker.getByRole('button', { name: 'Ask to leave Library wiring', exact: true }).click();
    await expect(worker.getByText('Requested', { exact: true })).toBeVisible();
    await expect(worker.getByText('Asked to leave · waiting for a manager', { exact: true })).toBeVisible();
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

// A foreman asks the role under test to join or leave Library wiring under approval rules.
async function participationScenario(page: Page, browser: Browser, role: string) {
  const fixture = await workspace(page);
  const reviewerContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const workerContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 375, height: 812 },
  });
  const close = async () => {
    await reviewerContext.close();
    await workerContext.close();
  };
  const reviewer = role === 'admin' ? page : await reviewerContext.newPage();
  const worker = await workerContext.newPage();
  const [member] = await Promise.all([
    invitedMember(page, worker, fixture.base, 'foreman', 'Approval operator'),
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
  // Asking is one tap: no dialog, the row just says it is waiting.
  const request = async (intent: 'join' | 'leave') => {
    await worker.goto('/app/jobs');
    await worker.getByRole('button', { name: `Ask to ${intent} Library wiring`, exact: true }).click();
    await expect(worker.getByText('Requested', { exact: true })).toBeVisible();
    await reviewer.goto('/app/jobs');
  };
  const history = async (): Promise<Locator> => {
    await reviewer.getByRole('button', { name: 'Request history', exact: true }).click();
    await expect(reviewer.getByRole('heading', { name: 'Request history', exact: true })).toBeVisible();
    return reviewer.getByRole('region', { name: 'Request history', exact: true });
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
    requests: reviewer.getByRole('region', { name: 'Join and leave requests', exact: true }),
    close,
  };
}

for (const role of ['admin', 'manager']) {
  test(`${role} rejects, sees a withdrawal of, then approves a join request on the job`, async ({ page, browser }) => {
    const { fixture, reviewer, worker, member, before, custody, request, history, close } = await participationScenario(
      page,
      browser,
      role,
    );
    try {
      const memberName = 'Approval operator';
      await request('join');
      await decision(reviewer, memberName, 'reject', 'Join rejected for scheduling');
      await request('join');
      await decision(worker, memberName, 'withdraw');
      await request('join');
      // The job's own page shows what is waiting on it, and decides it right there.
      await reviewer.getByRole('button', { name: 'Open Library wiring', exact: true }).click();
      const job = reviewer.getByRole('dialog', { name: 'Library wiring', exact: true });
      await job.getByRole('tab', { name: /^Requests/ }).click();
      await job.getByRole('button', { name: `Approve ${memberName}’s request`, exact: true }).click();
      await expect(job.getByRole('tab', { name: /^Requests/ })).toHaveCount(0);
      await expect(
        job.getByRole('list', { name: 'Who’s on this job', exact: true }).getByText(memberName, { exact: true }),
      ).toBeVisible();
      await reviewer.keyboard.press('Escape');
      expect((await (await reviewer.request.get(`${fixture.base}/assignments`)).json()).items).toMatchObject([
        { membership_id: member.id },
      ]);
      const decided = await history();
      await expect(decided.getByText(/Asks to join Library wiring · Approved/)).toBeVisible();
      await expect(decided.getByText(/Join rejected for scheduling/)).toBeVisible();
      expect(await custody()).toEqual(before);
      await worker.goto('/app/jobs');
      await expect(worker.getByRole('button', { name: 'Ask to leave Library wiring', exact: true })).toBeVisible();
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
        reason: 'Already on the crew',
      });
      const memberName = 'Approval operator';
      await request('leave');
      await decision(reviewer, memberName, 'reject', 'Leave rejected until handover');
      await request('leave');
      await decision(worker, memberName, 'withdraw');
      await request('leave');
      // Taking them off and putting them back on leaves the request pointing at an ended assignment.
      await reviewer.getByRole('button', { name: 'Open Library wiring', exact: true }).click();
      const job = reviewer.getByRole('dialog', { name: 'Library wiring', exact: true });
      await staff(reviewer, 'Library wiring', { [memberName]: false });
      await expect(job.getByText('No one is on this job yet.')).toBeVisible();
      await staff(reviewer, 'Library wiring', { [memberName]: true });
      await expect(
        job.getByRole('list', { name: 'Who’s on this job', exact: true }).getByText(memberName, { exact: true }),
      ).toBeVisible();
      await reviewer.keyboard.press('Escape');
      await expect(job).toHaveCount(0);
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
      await request('leave');
      await decision(reviewer, memberName, 'approve', 'Current leave approved');
      expect((await (await reviewer.request.get(`${fixture.base}/assignments`)).json()).items).toEqual([]);
      const decided = await history();
      await expect(decided.getByText(/Current leave approved/)).toBeVisible();
      await expect(decided.getByText(/Leave rejected until handover/)).toBeVisible();
      expect(await custody()).toEqual(before);
      await worker.goto('/app/jobs');
      await expect(worker.getByRole('button', { name: 'Ask to join Library wiring', exact: true })).toBeVisible();
      await worker.screenshot({ path: `artifacts/jobs-participation-${role}-mobile.png`, fullPage: true });
      expect(await worker.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    } finally {
      await close();
    }
  });
}
