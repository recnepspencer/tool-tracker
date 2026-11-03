import { expect, type Browser, type Page } from '@playwright/test';
import { chooseDestination, command, invitedMember, workspace, test } from './support';

type Fixture = Awaited<ReturnType<typeof workspace>>;
async function requestTool(worker: Page, fixture: Fixture) {
  await worker.goto(`/app/checkout/${fixture.asset.id}?action=request`);
  await worker.getByRole('button', { name: 'Request from Main warehouse', exact: true }).click();
  // The action panel closes once the request is recorded, and the sheet shows it waiting.
  await expect(worker.getByRole('form', { name: 'Action details', exact: true })).toHaveCount(0);
  await expect(worker.getByText('Requested from Main warehouse. Waiting for review.', { exact: false })).toBeVisible();
}
const requestButtons = { reject: 'Decline', withdraw: 'Withdraw request', approve: 'Release to worker' };
async function requestDecision(actor: Page, decision: keyof typeof requestButtons) {
  await actor.goto('/app/operations');
  await actor.getByRole('button', { name: 'Review request for Hammer drill', exact: true }).click();
  const dialog = actor.getByRole('dialog', { name: 'Review Hammer drill', exact: true });
  await dialog.getByLabel('Decision note').fill(`Decision: ${decision}`);
  await dialog.getByRole('button', { name: requestButtons[decision], exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
// Person-to-person handoffs are decided from each party's own pending list on My tools.
const handoffButtons = { accept: 'Accept — take custody', decline: 'Decline', cancel: 'Cancel transfer' };
async function handoffDecision(actor: Page, decision: keyof typeof handoffButtons, note = '') {
  await actor.goto('/app/mine');
  await actor
    .getByRole('article', { name: 'Hammer drill pending handoff', exact: true })
    .getByRole('button', { name: decision === 'cancel' ? 'Review transfer' : 'Review and accept', exact: true })
    .click();
  const dialog = actor.getByRole('dialog', { name: 'Hammer drill transfer review', exact: true });
  if (note) await dialog.getByLabel('Note').fill(note);
  if (decision === 'accept')
    await dialog.getByRole('checkbox', { name: 'I have inspected this tool', exact: true }).click();
  await actor.getByRole('button', { name: handoffButtons[decision], exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(actor.getByRole('article', { name: 'Hammer drill pending handoff', exact: true })).toHaveCount(0);
}
// Returns to a warehouse land in the operations gate queue.
async function acceptReturn(actor: Page) {
  await actor.goto('/app/operations');
  await actor.getByRole('button', { name: 'Review return for Hammer drill', exact: true }).click();
  const dialog = actor.getByRole('dialog', { name: 'Review Hammer drill', exact: true });
  await dialog.getByRole('button', { name: 'Accept return', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(actor.getByRole('button', { name: 'Review return for Hammer drill', exact: true })).toHaveCount(0);
}
async function proposeTransfer(holder: Page, fixture: Fixture, kind: 'Person' | 'Warehouse', name: string) {
  await holder.goto(`/app/mine/${fixture.asset.id}?action=transfer`);
  await chooseDestination(holder, kind, name);
  await holder.getByRole('button', { name: `Send to ${name}`, exact: true }).click();
  await expect(holder.getByText(`In transfer to ${name}.`, { exact: false })).toBeVisible();
}

// A field member requests UNIT-001 and the role under test reviews it.
async function requestScenario(page: Page, browser: Browser, role: string) {
  const fixture = await workspace(page);
  const workerContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const reviewerContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const worker = await workerContext.newPage();
  const reviewer = role === 'company_admin' ? page : await reviewerContext.newPage();
  const member = await invitedMember(page, worker, fixture.base, 'field_member', 'Field operator');
  if (reviewer !== page) {
    const manager = await invitedMember(
      page,
      reviewer,
      fixture.base,
      role === 'warehouse' ? 'field_member' : role,
      'Equipment reviewer',
    );
    if (role === 'warehouse')
      await command(page.request, `${fixture.base}/warehouses/${fixture.warehouse.id}/authority`, {
        expected_revision: 1,
        membership_id: manager.id,
        enabled: true,
      });
  }
  const custody = async () =>
    (await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json()).items;
  const close = async () => {
    await workerContext.close();
    await reviewerContext.close();
  };
  return { fixture, worker, reviewer, member, custody, initial: await custody(), close };
}

for (const role of ['company_admin', 'equipment_manager', 'warehouse']) {
  test(`${role} rejects, sees withdrawals and a withdrawn release without moving custody`, async ({
    page,
    browser,
  }) => {
    const { fixture, worker, reviewer, custody, initial, close } = await requestScenario(page, browser, role);
    try {
      await requestTool(worker, fixture);
      await requestDecision(reviewer, 'reject');
      expect(await custody()).toEqual(initial);
      await requestTool(worker, fixture);
      await requestDecision(worker, 'withdraw');
      expect(await custody()).toEqual(initial);
      await requestTool(worker, fixture);
      await requestDecision(reviewer, 'approve');
      expect(await custody()).toEqual(initial);
      await requestDecision(worker, 'withdraw');
      expect((await (await page.request.get(`${fixture.base}/handoffs`)).json()).items).toEqual([]);
      expect(await custody()).toEqual(initial);
      await reviewer.goto('/app/operations?history=true');
      await expect(reviewer.getByText('“Decision: reject”', { exact: true })).toBeVisible();
    } finally {
      await close();
    }
  });

  test(`${role} releases a tool the worker declines, then one the worker actually receives`, async ({
    page,
    browser,
  }) => {
    const { fixture, worker, reviewer, member, custody, initial, close } = await requestScenario(page, browser, role);
    try {
      await requestTool(worker, fixture);
      await requestDecision(reviewer, 'approve');
      await handoffDecision(worker, 'decline');
      expect(await custody()).toEqual(initial);
      await requestTool(worker, fixture);
      await requestDecision(reviewer, 'approve');
      await handoffDecision(worker, 'accept');
      const received = await custody();
      expect(received).toHaveLength(2);
      expect(received[0]).toMatchObject({
        holder_membership_id: member.id,
        holder_name: 'Field operator',
        ends_at: null,
      });
      expect((await (await page.request.get(`${fixture.base}/tools/${fixture.second.id}`)).json()).warehouse_id).toBe(
        fixture.warehouse.id,
      );
      await reviewer.goto('/app/operations?history=true');
      await expect(reviewer.getByText('Request fulfilled', { exact: true })).toBeVisible();
    } finally {
      await close();
    }
  });
}
// The role under test holds UNIT-001; a field member can be named to receive it.
async function holderScenario(page: Page, browser: Browser, role: string, withReceiver: boolean) {
  const fixture = await workspace(page);
  const holderContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const receiverContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const close = async () => {
    await holderContext.close();
    await receiverContext.close();
  };
  const holder = role === 'company_admin' ? page : await holderContext.newPage();
  const receiver = await receiverContext.newPage();
  const [holderMember] = await Promise.all([
    holder === page
      ? (await (await page.request.get('/api/me')).json()).memberships.find(
          (item: { company_id: string }) => item.company_id === fixture.company.id,
        )
      : invitedMember(page, holder, fixture.base, role === 'warehouse' ? 'field_member' : role, 'Tool holder'),
    withReceiver ? invitedMember(page, receiver, fixture.base, 'field_member', 'Receiving operator') : undefined,
  ]);
  const holderId = holderMember.id ?? holderMember.membership_id;
  if (role === 'warehouse')
    await command(page.request, `${fixture.base}/warehouses/${fixture.warehouse.id}/authority`, {
      expected_revision: 1,
      membership_id: holderId,
      enabled: true,
    });
  const issued = await command(page.request, `${fixture.base}/tools/${fixture.asset.id}/handoffs`, {
    request_key: crypto.randomUUID(),
    expected_revision: fixture.asset.revision,
    destination_membership_id: holderId,
  });
  await command(holder.request, `${fixture.base}/handoffs/${issued.id}/accept`, {
    expected_revision: issued.revision,
  });
  const tool = async () => await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}`)).json();
  return { fixture, holder, receiver, holderId, tool, close };
}

for (const role of ['company_admin', 'equipment_manager', 'field_member', 'warehouse']) {
  test(`${role} as holder keeps a unit the receiver declines or the holder cancels`, async ({ page, browser }) => {
    const { fixture, holder, receiver, holderId, tool, close } = await holderScenario(page, browser, role, true);
    try {
      await proposeTransfer(holder, fixture, 'Person', 'Receiving operator');
      await handoffDecision(receiver, 'decline');
      expect((await tool()).holder_membership_id).toBe(holderId);
      await proposeTransfer(holder, fixture, 'Person', 'Receiving operator');
      await handoffDecision(holder, 'cancel');
      expect((await tool()).holder_membership_id).toBe(holderId);
      expect(
        (await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json()).items,
      ).toHaveLength(2);
    } finally {
      await close();
    }
  });

  test(`${role} as holder returns a specific unit to its warehouse`, async ({ page, browser }) => {
    const { fixture, holder, tool, close } = await holderScenario(page, browser, role, false);
    try {
      await proposeTransfer(holder, fixture, 'Warehouse', 'Main warehouse');
      await acceptReturn(page);
      expect(await tool()).toMatchObject({
        warehouse_id: fixture.warehouse.id,
        holder_membership_id: null,
        responsible_warehouse_id: fixture.warehouse.id,
      });
      expect(
        (await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json()).items,
      ).toHaveLength(3);
    } finally {
      await close();
    }
  });
}

test('a photographed handoff recovers a committed command after its response is lost', async ({ page, browser }) => {
  const fixture = await workspace(page);
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const receiver = await context.newPage();
  try {
    await invitedMember(page, receiver, fixture.base, 'field_member', 'Photo receiver');
    await page.goto(`/app/tools/${fixture.asset.id}?action=transfer`);
    const form = page.getByRole('dialog', { name: 'Transfer Hammer drill', exact: true });
    await chooseDestination(page, 'Person', 'Photo receiver');
    await form.locator('input[type="file"][name="photo"]').setInputFiles('e2e/fixtures/hammer-drill.jpg');
    await page.route(
      `**${fixture.base}/tools/${fixture.asset.id}/handoffs`,
      async (route) => {
        const response = await route.fetch();
        expect(response.status()).toBe(201);
        await route.abort('connectionreset');
      },
      { times: 1 },
    );
    await form.getByRole('button', { name: 'Send to Photo receiver', exact: true }).click();
    await expect(form.getByRole('alert')).toBeVisible();
    // Retrying reuses the same request key, so the committed proposal is returned instead of duplicated.
    await form.getByRole('button', { name: 'Send to Photo receiver', exact: true }).click();
    await expect(form).toHaveCount(0);
    await expect(
      page
        .getByRole('region', { name: 'Pending handoff', exact: true })
        .getByText('Waiting for Photo receiver to accept.', { exact: true }),
    ).toBeVisible();
    const handoffs = (await (await page.request.get(`${fixture.base}/handoffs`)).json()).items;
    expect(handoffs).toHaveLength(1);
    expect(handoffs[0].photo_ids).toHaveLength(1);
    expect((await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}`)).json()).warehouse_id).toBe(
      fixture.warehouse.id,
    );
  } finally {
    await context.close();
  }
});
