import { test, expect, type Page } from '@playwright/test';
import { chooseDestination, command, invitedMember, workspace } from './support';

async function report(page: Page, kind: 'damage' | 'missing', description: string, photo = false) {
  await page.getByRole('button', { name: kind === 'damage' ? 'Report damaged' : 'Report lost', exact: true }).click();
  const form = page.getByRole('region', { name: 'Report a problem', exact: true });
  await form.getByLabel('What happened?').fill(description);
  if (photo) await form.getByLabel('Photo (optional, up to 8 MB)').setInputFiles('e2e/fixtures/hammer-drill.jpg');
  await form.getByRole('button', { name: 'Submit report', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Open reports', exact: true }).getByText(description, { exact: true }),
  ).toBeVisible();
}

async function repair(page: Page, condition: string, note: string, photo = false) {
  const form = page.getByRole('region', { name: 'Record service', exact: true });
  await form.getByLabel('Condition', { exact: true }).selectOption(condition);
  await form.getByLabel('Work performed').fill(note);
  if (photo) await form.getByLabel('Photo (optional, up to 8 MB)').setInputFiles('e2e/fixtures/hammer-drill.jpg');
  await form.getByRole('button', { name: 'Save service record', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Service history', exact: true }).getByText(note, { exact: true }),
  ).toBeVisible();
}

for (const role of ['company_admin', 'equipment_manager', 'warehouse'])
  test(`${role} resolves condition, repairs, retires, restores and disposes one physical unit`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(150_000);
    const fixture = await workspace(page);
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
    const actor = role === 'company_admin' ? page : await context.newPage();
    const actorName = role === 'company_admin' ? 'Workspace Owner' : 'Maintenance lead';
    try {
      if (actor !== page) {
        const member = await invitedMember(
          page,
          actor,
          fixture.base,
          role === 'warehouse' ? 'field_member' : role,
          actorName,
        );
        if (role === 'warehouse')
          await command(page.request, `${fixture.base}/warehouses/${fixture.warehouse.id}/authority`, {
            expected_revision: 1,
            membership_id: member.id,
            enabled: true,
          });
      }
      const custody = (await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json())
        .items;
      const other = await (await page.request.get(`${fixture.base}/tools/${fixture.second.id}`)).json();
      await actor.goto(`/app/tools/${fixture.asset.id}`);
      await report(actor, 'damage', 'Trigger broken during use', true);
      await expect(actor.getByRole('button', { name: 'Report damaged', exact: true })).toHaveCount(0);
      await report(actor, 'missing', 'Not located during stock check');
      const reports = actor.getByRole('region', { name: 'Open reports', exact: true });
      await expect(reports.getByRole('article')).toHaveCount(2);
      await reports.getByLabel('Where was it found?').fill('Located in the returns cage');
      await reports.getByRole('button', { name: 'Mark found', exact: true }).click();
      await expect(reports.getByRole('article', { name: 'missing report', exact: true })).toHaveCount(0);
      let tool = await (await actor.request.get(`${fixture.base}/tools/${fixture.asset.id}`)).json();
      expect(tool).toMatchObject({ missing: false, serviceability: 'damaged' });
      await actor.getByRole('button', { name: 'Manage this tool', exact: true }).click();
      await repair(actor, 'out_of_service', 'Waiting for a replacement trigger');
      await expect(reports.getByRole('article', { name: 'damage report', exact: true })).toBeVisible();
      await repair(actor, 'serviceable', 'Replaced trigger and tested under load', true);
      await expect(reports.getByText('No open reports.', { exact: true })).toBeVisible();
      await reports.locator('summary').click();
      await expect(reports.getByText('Located in the returns cage', { exact: true })).toBeVisible();
      await expect(reports.getByText('Replaced trigger and tested under load', { exact: true })).toBeVisible();
      await expect(reports.getByText(`Reported by ${actorName}`, { exact: false })).toHaveCount(2);
      for (const label of ['Download report photo 1', 'Download service photo 1']) {
        const href = await actor.getByRole('link', { name: label, exact: true }).getAttribute('href');
        const download = await actor.request.get(href!);
        expect(download.status()).toBe(200);
        expect(download.headers()['content-type']).toContain('image/jpeg');
        expect(download.headers()['cache-control']).toContain('no-store');
      }
      expect(
        (await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json()).items,
      ).toEqual(custody);
      const lifecycle = actor.getByRole('region', { name: 'Retirement & disposal', exact: true });
      const history = actor.getByRole('region', { name: 'Retirement & disposal history', exact: true });
      for (const [status, reason] of [
        ['retired', 'Withdrawn pending inspection'],
        ['active', 'Inspection complete; returned to stock'],
      ]) {
        await lifecycle.getByLabel('Inventory status').selectOption(status);
        await lifecycle.getByLabel('Reason', { exact: true }).fill(reason);
        await lifecycle.getByRole('button', { name: 'Update status', exact: true }).click();
        await expect(history.getByText(reason, { exact: true })).toBeVisible();
        expect(
          (await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json()).items,
        ).toEqual(custody);
      }
      await command(actor.request, `${fixture.base}/tools/${fixture.asset.id}/requests`, {
        request_key: crypto.randomUUID(),
        note: 'For the next shift',
      });
      await actor.reload();
      await lifecycle.getByLabel('Inventory status').selectOption('disposed');
      await lifecycle.getByLabel('Reason', { exact: true }).fill('Housing recycled; removed from inventory');
      await lifecycle.getByRole('button', { name: 'Update status', exact: true }).click();
      await expect(
        actor.getByText('Disposal is permanent. This tool cannot be restored.', { exact: true }),
      ).toBeVisible();
      await expect(history.getByText('Housing recycled; removed from inventory', { exact: true })).toBeVisible();
      await expect(history.getByText(`Changed by ${actorName}`, { exact: false })).toHaveCount(3);
      await expect(actor.getByRole('button', { name: 'Save service record', exact: true })).toHaveCount(0);
      await actor.reload();
      await expect(history.getByRole('article')).toHaveCount(3);
      tool = await (await actor.request.get(`${fixture.base}/tools/${fixture.asset.id}`)).json();
      expect(tool).toMatchObject({
        lifecycle: 'disposed',
        warehouse_id: null,
        holder_membership_id: null,
        requestable: false,
        responsible_warehouse_id: fixture.warehouse.id,
      });
      const ended = (await (await actor.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json()).items;
      expect(ended).toHaveLength(1);
      expect(ended[0].id).toBe(custody[0].id);
      expect(ended[0].ends_at).not.toBeNull();
      const requests = (await (await actor.request.get(`${fixture.base}/tool-requests?pending=false&mine=true`)).json())
        .items;
      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({
        status: 'rejected',
        decision_note: 'Housing recycled; removed from inventory',
      });
      expect(await (await page.request.get(`${fixture.base}/tools/${fixture.second.id}`)).json()).toEqual(other);
      if (role === 'warehouse') {
        await actor.setViewportSize({ width: 390, height: 844 });
        await expect(actor.getByRole('heading', { name: 'Hammer drill', exact: true })).toBeVisible();
        await history.scrollIntoViewIfNeeded();
        await expect(history.getByText('Housing recycled; removed from inventory', { exact: true })).toBeVisible();
        await actor.screenshot({ path: 'artifacts/tool-disposal-history-mobile.png', fullPage: true });
        expect(await actor.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    } finally {
      await context.close();
    }
  });

test('a field holder reports with photos and returns a damaged tool for repair without losing its history', async ({
  page,
  browser,
}) => {
  const fixture = await workspace(page);
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173', viewport: { width: 390, height: 844 } });
  const holder = await context.newPage();
  try {
    const member = await invitedMember(page, holder, fixture.base, 'field_member', 'Field operator');
    const issue = await command(page.request, `${fixture.base}/tools/${fixture.asset.id}/handoffs`, {
      expected_revision: 1,
      request_key: crypto.randomUUID(),
      destination_membership_id: member.id,
    });
    await command(holder.request, `${fixture.base}/handoffs/${issue.id}/accept`, { expected_revision: issue.revision });
    const custody = (await (await holder.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json())
      .items;
    await holder.goto(`/app/mine/${fixture.asset.id}`);
    await expect(holder.getByRole('button', { name: 'Manage this tool', exact: true })).toHaveCount(0);
    await report(holder, 'damage', 'Trigger stopped working on site', true);
    await report(holder, 'missing', 'Misplaced during shift handover');
    await expect(holder.getByRole('button', { name: 'Mark found', exact: true })).toHaveCount(0);
    await page.goto(`/app/tools/${fixture.asset.id}`);
    const reports = page.getByRole('region', { name: 'Open reports', exact: true });
    await reports.getByLabel('Where was it found?').fill('Found in the locked site cabinet');
    await reports.getByRole('button', { name: 'Mark found', exact: true }).click();
    await expect(reports.getByRole('article', { name: 'missing report', exact: true })).toHaveCount(0);
    expect(
      (await (await holder.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json()).items,
    ).toEqual(custody);
    await holder.reload();
    await holder.getByRole('button', { name: 'Transfer tool', exact: true }).click();
    await chooseDestination(holder, 'Warehouse', 'Main warehouse');
    await holder.getByRole('button', { name: 'Propose handoff', exact: true }).click();
    await expect(holder.getByText(/This tool has a pending handoff/)).toBeVisible();
    expect(
      (await (await holder.request.get(`${fixture.base}/tools/${fixture.asset.id}`)).json()).holder_membership_id,
    ).toBe(member.id);
    await page.goto('/app/operations');
    await page.getByRole('button', { name: 'Review handoff', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm handoff decision', exact: true }).click();
    await expect(page.getByText('No handoffs to review.')).toBeVisible();
    await page.goto(`/app/tools/${fixture.asset.id}?action=manage`);
    await repair(page, 'serviceable', 'Replaced trigger and returned to stock', true);
    await holder.goto(`/app/checkout/${fixture.asset.id}`);
    await holder.getByRole('region', { name: 'Open reports', exact: true }).locator('summary').click();
    await expect(holder.getByText('Found in the locked site cabinet', { exact: true })).toBeVisible();
    await expect(holder.getByText('Replaced trigger and returned to stock', { exact: true })).toHaveCount(2);
    const service = holder.getByRole('region', { name: 'Service history', exact: true });
    await expect(service.getByText('Recorded by Workspace Owner', { exact: false })).toBeVisible();
    const photo = await service
      .getByRole('link', { name: 'Download service photo 1', exact: true })
      .getAttribute('href');
    expect((await holder.request.get(photo!)).status()).toBe(200);
    const tool = await (await holder.request.get(`${fixture.base}/tools/${fixture.asset.id}`)).json();
    expect(tool).toMatchObject({
      warehouse_id: fixture.warehouse.id,
      missing: false,
      serviceability: 'serviceable',
      requestable: true,
    });
    const history = (await (await holder.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json())
      .items;
    expect(history).toHaveLength(3);
    expect(history[1]).toMatchObject({ holder_membership_id: member.id, holder_name: 'Field operator' });
  } finally {
    await context.close();
  }
});
