import { expect, type Locator, type Page } from '@playwright/test';
import { chooseDestination, command, invitedMember, workspace, chooseOption, test } from './support';

const photoFile = 'e2e/fixtures/hammer-drill.jpg';
const reportsOf = (page: Page) => page.getByRole('region', { name: 'Open reports', exact: true });
const timelineOf = (page: Page) => page.getByRole('region', { name: 'Timeline', exact: true });
const entry = (scope: Locator, action: string) =>
  scope.getByRole('listitem').filter({ has: scope.page().getByText(action, { exact: true }) });

/** A photo thumbnail links to the full evidence photo; follow it and check it is private and fresh. */
async function expectPhotoDownload(page: Page, scope: Locator, name: string) {
  const link = scope.locator('a').filter({ has: page.getByRole('img', { name, exact: true }) });
  const href = await link.getAttribute('href');
  const download = await page.request.get(href!);
  expect(download.status()).toBe(200);
  expect(download.headers()['content-type']).toContain('image/jpeg');
  expect(download.headers()['cache-control']).toContain('no-store');
}

/** Managers flag condition from the inventory drawer's "Mark damaged" / "Mark lost" dialogs. */
async function flag(page: Page, kind: 'damage' | 'missing', description: string, photo = false) {
  const action = kind === 'damage' ? 'Mark damaged' : 'Mark lost';
  await page.getByRole('button', { name: action, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: `${action}: Hammer drill`, exact: true });
  await expect(dialog.getByRole('combobox', { name: 'Condition', exact: true })).toHaveText(
    kind === 'damage' ? 'Damaged' : 'Lost',
  );
  await dialog.getByLabel('Evidence note').fill(description);
  if (photo) await dialog.locator('input[type="file"][name="photo"]').setInputFiles(photoFile);
  await dialog.getByRole('button', { name: action, exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(reportsOf(page).getByText(description, { exact: true })).toBeVisible();
}

/** Holders report from the field sheet's action panel. */
async function report(page: Page, kind: 'damage' | 'missing', description: string, photo = false) {
  await page.getByRole('button', { name: kind === 'damage' ? 'Report damaged' : 'Report lost', exact: true }).click();
  const form = page.getByRole('form', { name: 'Action details', exact: true });
  await form.getByLabel('What happened?').fill(description);
  if (photo) await form.locator('input[type="file"][name="photo"]').setInputFiles(photoFile);
  await form.getByRole('button', { name: kind === 'damage' ? 'Report damage' : 'Report loss', exact: true }).click();
  await expect(form).toHaveCount(0);
  await expect(reportsOf(page).getByText(description, { exact: true })).toBeVisible();
}

async function markFound(page: Page, note: string) {
  await reportsOf(page).getByRole('button', { name: 'Mark found', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Mark Hammer drill found', exact: true });
  await dialog.getByLabel('Where was it found?').fill(note);
  await dialog.getByRole('button', { name: 'Mark found', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

async function repair(page: Page, condition: string, note: string, photo = false) {
  await page.getByRole('button', { name: 'Record service', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Record service for Hammer drill', exact: true });
  await chooseOption(dialog, 'Condition', condition);
  await dialog.getByLabel('Work performed').fill(note);
  if (photo) await dialog.locator('input[type="file"][name="photo"]').setInputFiles(photoFile);
  await dialog.getByRole('button', { name: 'Save service record', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  // A serviceable result also closes the damage report with the same note.
  await expect(timelineOf(page).getByText(note, { exact: true }).first()).toBeVisible();
}

async function changeLifecycle(page: Page, status: string, reason: string) {
  const retired = await page.getByRole('button', { name: 'Reinstate or dispose', exact: true }).count();
  await page.getByRole('button', { name: retired ? 'Reinstate or dispose' : 'Decommission tool', exact: true }).click();
  const dialog = page.getByRole('dialog', {
    name: `${retired ? 'Change lifecycle of' : 'Decommission'} Hammer drill`,
    exact: true,
  });
  await chooseOption(dialog, 'Lifecycle', status);
  await dialog.getByLabel('Reason or evidence note').fill(reason);
  await dialog.getByRole('button', { name: retired ? 'Update lifecycle' : 'Decommission', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(timelineOf(page).getByText(reason, { exact: true })).toBeVisible();
}

for (const role of ['admin', 'manager', 'warehouse'])
  test(`${role} resolves condition, repairs, retires, restores and disposes one physical unit`, async ({
    page,
    browser,
  }) => {
    const fixture = await workspace(page);
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
    const actor = role === 'admin' ? page : await context.newPage();
    const actorName = role === 'admin' ? 'Workspace Owner' : 'Maintenance lead';
    try {
      if (actor !== page) {
        const member = await invitedMember(
          page,
          actor,
          fixture.base,
          role === 'warehouse' ? 'foreman' : role,
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
      const reports = reportsOf(actor);
      const timeline = timelineOf(actor);
      await flag(actor, 'damage', 'Trigger broken during use', true);
      await expect(actor.getByRole('button', { name: 'Mark damaged', exact: true })).toHaveCount(0);
      await flag(actor, 'missing', 'Not located during stock check');
      await expect(reports.getByRole('listitem')).toHaveCount(2);
      await markFound(actor, 'Located in the returns cage');
      await expect(reports.getByRole('listitem', { name: 'Reported lost', exact: true })).toHaveCount(0);
      let tool = await (await actor.request.get(`${fixture.base}/tools/${fixture.asset.id}`)).json();
      expect(tool).toMatchObject({ missing: false, serviceability: 'damaged' });
      await repair(actor, 'out_of_service', 'Waiting for a replacement trigger');
      await expect(reports.getByRole('listitem', { name: 'Reported damaged', exact: true })).toBeVisible();
      await repair(actor, 'serviceable', 'Replaced trigger and tested under load', true);
      // Once every report is resolved the open-reports list goes away; the record stays in the timeline.
      await expect(reports).toHaveCount(0);
      await expect(entry(timeline, 'Marked found')).toContainText('Located in the returns cage');
      await expect(entry(timeline, 'Restored to service')).toContainText('Replaced trigger and tested under load');
      for (const action of ['Reported damaged', 'Reported lost'])
        await expect(entry(timeline, action)).toContainText(actorName);
      await expectPhotoDownload(actor, timeline, 'Reported damaged photo 1');
      await expectPhotoDownload(actor, timeline, 'Restored to service photo 1');
      expect(
        (await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json()).items,
      ).toEqual(custody);
      for (const [status, reason] of [
        ['retired', 'Withdrawn pending inspection'],
        ['active', 'Inspection complete; returned to stock'],
      ]) {
        await changeLifecycle(actor, status, reason);
        expect(
          (await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json()).items,
        ).toEqual(custody);
      }
      await command(actor.request, `${fixture.base}/tools/${fixture.asset.id}/requests`, {
        request_key: crypto.randomUUID(),
        note: 'For the next shift',
      });
      await actor.reload();
      await changeLifecycle(actor, 'disposed', 'Housing recycled; removed from inventory');
      await expect(actor.getByText('Disposal is permanent', { exact: true })).toBeVisible();
      await expect(actor.getByText('This tool cannot be restored.', { exact: false })).toBeVisible();
      const lifecycleActions = ['Retired', 'Returned to active inventory', 'Disposed'];
      for (const action of lifecycleActions) await expect(entry(timeline, action)).toContainText(actorName);
      await expect(actor.getByRole('button', { name: 'Record service', exact: true })).toHaveCount(0);
      await expect(actor.getByRole('button', { name: 'Decommission tool', exact: true })).toHaveCount(0);
      await actor.reload();
      for (const action of lifecycleActions) await expect(entry(timeline, action)).toHaveCount(1);
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
        await timeline.scrollIntoViewIfNeeded();
        await expect(timeline.getByText('Housing recycled; removed from inventory', { exact: true })).toBeVisible();
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
    const member = await invitedMember(page, holder, fixture.base, 'foreman', 'Field operator');
    const issue = await command(page.request, `${fixture.base}/tools/${fixture.asset.id}/handoffs`, {
      expected_revision: 1,
      request_key: crypto.randomUUID(),
      destination_membership_id: member.id,
    });
    await command(holder.request, `${fixture.base}/handoffs/${issue.id}/accept`, { expected_revision: issue.revision });
    const custody = (await (await holder.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json())
      .items;
    await holder.goto(`/app/mine/${fixture.asset.id}`);
    const sheet = holder.getByRole('dialog', { name: 'Tool details', exact: true });
    await expect(sheet.getByRole('heading', { name: 'Hammer drill', exact: true })).toBeVisible();
    // Holders get the field sheet, without the inventory management commands.
    for (const name of ['Edit', 'Record service', 'Decommission tool'])
      await expect(holder.getByRole('button', { name, exact: true })).toHaveCount(0);
    await report(holder, 'damage', 'Trigger stopped working on site', true);
    await report(holder, 'missing', 'Misplaced during shift handover');
    await expect(holder.getByRole('button', { name: 'Mark found', exact: true })).toHaveCount(0);
    await page.goto(`/app/tools/${fixture.asset.id}`);
    const reports = reportsOf(page);
    await markFound(page, 'Found in the locked site cabinet');
    await expect(reports.getByRole('listitem', { name: 'Reported lost', exact: true })).toHaveCount(0);
    expect(
      (await (await holder.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json()).items,
    ).toEqual(custody);
    await holder.reload();
    await holder.getByRole('button', { name: 'Transfer tool', exact: true }).click();
    await chooseDestination(holder, 'Warehouse', 'Main warehouse');
    await holder.getByRole('button', { name: 'Send to Main warehouse', exact: true }).click();
    await expect(holder.getByText('In transfer to Main warehouse.', { exact: false })).toBeVisible();
    expect(
      (await (await holder.request.get(`${fixture.base}/tools/${fixture.asset.id}`)).json()).holder_membership_id,
    ).toBe(member.id);
    await page.goto('/app/operations');
    await page.getByRole('button', { name: 'Review return for Hammer drill', exact: true }).click();
    const review = page.getByRole('dialog', { name: 'Review Hammer drill', exact: true });
    await review.getByRole('button', { name: 'Accept return', exact: true }).click();
    await expect(review).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Review return for Hammer drill', exact: true })).toHaveCount(0);
    await page.goto(`/app/tools/${fixture.asset.id}`);
    await repair(page, 'serviceable', 'Replaced trigger and returned to stock', true);
    await holder.goto(`/app/checkout/${fixture.asset.id}`);
    const timeline = timelineOf(holder);
    await expect(reportsOf(holder)).toHaveCount(0);
    await expect(entry(timeline, 'Marked found')).toContainText('Found in the locked site cabinet');
    // The service note closes the damage report and is recorded as the repair.
    await expect(timeline.getByText('Replaced trigger and returned to stock', { exact: true })).toHaveCount(2);
    await expect(entry(timeline, 'Restored to service')).toContainText('Workspace Owner');
    const photo = await timeline
      .locator('a')
      .filter({ has: holder.getByRole('img', { name: 'Restored to service photo 1', exact: true }) })
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
