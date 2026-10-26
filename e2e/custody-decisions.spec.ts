import { test, expect, type Page } from '@playwright/test';
import { chooseDestination, command, invitedMember, workspace } from './support';

type Fixture = Awaited<ReturnType<typeof workspace>>;
async function requestTool(worker: Page, fixture: Fixture) {
  await worker.goto(`/app/checkout/${fixture.asset.id}`);
  await worker.getByRole('button', { name: 'Request this tool', exact: true }).click();
  await worker.getByRole('button', { name: 'Request tool', exact: true }).click();
  await expect(worker.getByText('Your request is waiting for review.')).toBeVisible();
}
async function requestDecision(actor: Page, decision: string) {
  await actor.goto('/app/operations');
  await actor
    .getByRole('region', { name: 'Tool requests', exact: true })
    .getByRole('button', { name: 'Review request' })
    .click();
  const dialog = actor.getByRole('dialog', { name: 'Review request' });
  await dialog.getByLabel('Decision', { exact: true }).selectOption(decision);
  await dialog.getByLabel('Decision note').fill(`Decision: ${decision}`);
  await dialog.getByRole('button', { name: 'Apply decision' }).click();
  await expect(dialog).toHaveCount(0);
}
async function handoffDecision(actor: Page, decision: string, note = '') {
  await actor.goto('/app/operations');
  await actor
    .getByRole('region', { name: 'Handoffs', exact: true })
    .getByRole('button', { name: 'Review handoff' })
    .click();
  const dialog = actor.getByRole('dialog', { name: 'Review handoff' });
  await dialog.getByLabel('Decision', { exact: true }).selectOption(decision);
  if (note) await dialog.getByLabel('Note', { exact: true }).fill(note);
  await dialog.getByRole('button', { name: 'Confirm handoff decision' }).click();
  await expect(dialog).toHaveCount(0);
}

for (const role of ['company_admin', 'equipment_manager', 'warehouse'])
  test(`${role} reviews rejection, withdrawal, approval, decline and actual receipt`, async ({ page, browser }) => {
    test.setTimeout(120_000);
    const fixture = await workspace(page);
    const workerContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
    const reviewerContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
    const worker = await workerContext.newPage();
    const reviewer = role === 'company_admin' ? page : await reviewerContext.newPage();
    try {
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
      const initial = await custody();
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
      await expect(reviewer.getByText('Decision: reject', { exact: true })).toBeVisible();
      await expect(reviewer.getByText('fulfilled', { exact: true })).toBeVisible();
    } finally {
      await workerContext.close();
      await reviewerContext.close();
    }
  });

for (const role of ['company_admin', 'equipment_manager', 'field_member', 'warehouse'])
  test(`${role} as holder transfers, cancels and returns a specific unit`, async ({ page, browser }) => {
    const fixture = await workspace(page);
    const holderContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
    const receiverContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
    const holder = role === 'company_admin' ? page : await holderContext.newPage();
    const receiver = await receiverContext.newPage();
    try {
      const holderMember =
        holder === page
          ? (await (await page.request.get('/api/me')).json()).memberships.find(
              (item: { company_id: string }) => item.company_id === fixture.company.id,
            )
          : await invitedMember(
              page,
              holder,
              fixture.base,
              role === 'warehouse' ? 'field_member' : role,
              'Tool holder',
            );
      const holderId = holderMember.id ?? holderMember.membership_id;
      await invitedMember(page, receiver, fixture.base, 'field_member', 'Receiving operator');
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
      await holder.goto(`/app/mine/${fixture.asset.id}?action=transfer`);
      await chooseDestination(holder, 'Person', 'Receiving operator');
      await holder.getByRole('button', { name: 'Propose handoff' }).click();
      await expect(holder.getByText(/This tool has a pending handoff/)).toBeVisible();
      await handoffDecision(receiver, 'decline');
      let tool = await (await holder.request.get(`${fixture.base}/tools/${fixture.asset.id}`)).json();
      expect(tool.holder_membership_id).toBe(holderId);
      await holder.goto(`/app/mine/${fixture.asset.id}?action=transfer`);
      await chooseDestination(holder, 'Person', 'Receiving operator');
      await holder.getByRole('button', { name: 'Propose handoff' }).click();
      await expect(holder.getByText(/This tool has a pending handoff/)).toBeVisible();
      await handoffDecision(holder, 'cancel');
      tool = await (await holder.request.get(`${fixture.base}/tools/${fixture.asset.id}`)).json();
      expect(tool.holder_membership_id).toBe(holderId);
      await holder.goto(`/app/mine/${fixture.asset.id}?action=transfer`);
      await chooseDestination(holder, 'Warehouse', 'Main warehouse');
      await holder.getByRole('button', { name: 'Propose handoff' }).click();
      await expect(holder.getByText(/This tool has a pending handoff/)).toBeVisible();
      await handoffDecision(page, 'accept');
      tool = await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}`)).json();
      expect(tool).toMatchObject({
        warehouse_id: fixture.warehouse.id,
        holder_membership_id: null,
        responsible_warehouse_id: fixture.warehouse.id,
      });
      expect(
        (await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json()).items,
      ).toHaveLength(3);
    } finally {
      await holderContext.close();
      await receiverContext.close();
    }
  });

test('a photographed handoff recovers a committed command after its response is lost', async ({ page, browser }) => {
  const fixture = await workspace(page);
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const receiver = await context.newPage();
  try {
    await invitedMember(page, receiver, fixture.base, 'field_member', 'Photo receiver');
    await page.goto(`/app/tools/${fixture.asset.id}?action=transfer`);
    const form = page.getByRole('region', { name: 'Transfer or return', exact: true });
    await chooseDestination(page, 'Person', 'Photo receiver');
    await form.getByLabel('Photo (optional, up to 8 MB)').setInputFiles('e2e/fixtures/hammer-drill.jpg');
    await page.route(
      `**${fixture.base}/tools/${fixture.asset.id}/handoffs`,
      async (route) => {
        const response = await route.fetch();
        expect(response.status()).toBe(201);
        await route.abort('connectionreset');
      },
      { times: 1 },
    );
    await form.getByRole('button', { name: 'Propose handoff' }).click();
    await expect(form.getByRole('alert')).toBeVisible();
    await form.getByRole('button', { name: 'Propose handoff' }).click();
    await expect(page.getByText(/This tool has a pending handoff/)).toBeVisible();
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
