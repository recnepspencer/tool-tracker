import { expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { command, workspace, emailLink, password, chooseOption, test } from './support';

test('field layout follows the demo with real photographed custody and review sheets', async ({ page, browser }) => {
  const fixture = await workspace(page);
  const workerContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1280, height: 900 },
  });
  const worker = await workerContext.newPage();
  try {
    const email = `ray-${crypto.randomUUID().slice(0, 8)}@example.com`;
    const invite = await command(page.request, `${fixture.base}/invitations`, {
      email,
      preferred_name: 'Ray Torres',
      role: 'field_member',
    });
    await command(worker.request, '/api/auth/signup', { email, name: 'Ray Torres', invitation_token: invite.token });
    const verification = new URL(await emailLink(email, '/verify-email'), 'http://localhost');
    await command(worker.request, '/api/auth/verify-signup', {
      token: verification.searchParams.get('token'),
      password,
    });
    const member = await command(worker.request, '/api/invitations/accept', { token: invite.token });
    const csrf = await (await page.request.get('/api/auth/csrf')).json();
    const upload = await page.request.post(`${fixture.base}/files`, {
      headers: { 'X-CSRFToken': csrf.csrf_token },
      multipart: {
        purpose: 'registration',
        file: {
          name: 'hammer-drill.jpg',
          mimeType: 'image/jpeg',
          buffer: await readFile('e2e/fixtures/hammer-drill.jpg'),
        },
      },
    });
    expect(upload.ok()).toBe(true);
    const photo = await upload.json();
    const model = await command(page.request, `${fixture.base}/tool-models`, {
      category_id: fixture.asset.category_id,
      name: 'Hammer drill',
      manufacturer: 'DeWalt',
      model_number: 'DCD996',
    });
    const asset = await command(page.request, `${fixture.base}/tools`, {
      request_key: crypto.randomUUID(),
      asset_tag: 'TL-101',
      warehouse_id: fixture.warehouse.id,
      tool_model_id: model.id,
      photo_id: photo.id,
    });
    const transfer = await command(page.request, `${fixture.base}/tools/${asset.id}/handoffs`, {
      request_key: crypto.randomUUID(),
      expected_revision: asset.revision,
      destination_membership_id: member.id,
      note: 'Collected at warehouse',
    });
    await command(worker.request, `${fixture.base}/handoffs/${transfer.id}/accept`, {
      expected_revision: transfer.revision,
      note: 'Received physical tool',
    });
    const received = await (await worker.request.get(`${fixture.base}/tools/${asset.id}`)).json();
    const custody = await (await worker.request.get(`${fixture.base}/tools/${asset.id}/custody`)).json();
    expect(received.category_name).toBe('Drills');
    expect(received.custody_started_at).toBe(
      custody.items.find((period: { ends_at: string | null }) => period.ends_at === null).starts_at,
    );
    const second = await (await page.request.get(`${fixture.base}/tools/${fixture.second.id}`)).json();
    await command(page.request, `${fixture.base}/tools/${second.id}/handoffs`, {
      request_key: crypto.randomUUID(),
      expected_revision: second.revision,
      destination_membership_id: member.id,
      note: 'Awaiting collection',
    });
    await worker.goto('/app/mine');
    await expect(worker.getByRole('heading', { name: 'My tools', exact: true })).toBeVisible();
    const held = worker.getByRole('button', { name: 'Open details for Hammer drill unit TL-101', exact: true });
    await expect(held).toBeVisible();
    // The unaccepted unit waits in the pending list instead of the held list.
    await expect(
      worker
        .getByRole('region', { name: 'Pending tool movements', exact: true })
        .getByRole('article', { name: 'Hammer drill pending handoff', exact: true }),
    ).toBeVisible();
    await expect(worker.locator('.worker-tool-row img')).toBeVisible();
    expect(await worker.locator('.experience').evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
      'rgb(6, 8, 12)',
    );
    expect(
      await worker.locator('.worker-main').evaluate((element) => Math.round(element.getBoundingClientRect().width)),
    ).toBe(900);
    expect(
      await worker
        .locator('.worker-tool-row .tool-photo')
        .evaluate((element) => Math.round(element.getBoundingClientRect().width)),
    ).toBe(62);
    await worker.screenshot({ path: 'artifacts/parity-worker-desktop.png', fullPage: true });
    await worker.setViewportSize({ width: 390, height: 844 });
    await worker.screenshot({ path: 'artifacts/parity-worker-mobile.png', fullPage: true });
    expect(await worker.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const startTransfer = worker.getByRole('button', { name: 'Transfer Hammer drill unit TL-101', exact: true });
    await startTransfer.click();
    await expect(worker.getByRole('dialog', { name: 'Tool details' })).toBeVisible();
    await expect(worker.getByRole('form', { name: 'Action details', exact: true })).toBeVisible();
    await worker.keyboard.press('Escape');
    await expect(worker.getByRole('dialog')).toHaveCount(0);
    await expect(startTransfer).toBeFocused();
    await worker.getByRole('link', { name: 'Browse checkout catalog' }).click();
    await expect(worker.getByRole('heading', { name: 'Browse tools', exact: true })).toBeVisible();
    // Landing on checkout opens the catalog filters first, as in the demo.
    const catalogFilters = worker.getByRole('dialog', { name: 'Catalog filters', exact: true });
    await expect(catalogFilters).toBeVisible();
    await worker.getByRole('button', { name: 'Close filters', exact: true }).click();
    await expect(catalogFilters).toHaveCount(0);
    await worker.getByRole('button', { name: 'List', exact: true }).click();
    await expect(worker.getByRole('button', { name: 'List', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await worker.screenshot({ path: 'artifacts/parity-checkout-mobile.png', fullPage: true });
    // Catalog cards are per model; the Makita model still has UNIT-001 to request.
    const requestable = worker.getByRole('button', { name: 'Open Hammer drill', exact: true }).filter({
      hasText: 'Makita',
    });
    await requestable.click();
    await expect(worker).toHaveURL(new RegExp(`/app/checkout/${fixture.asset.id}\\?action=request$`));
    await expect(worker.getByRole('dialog', { name: 'Tool details', exact: true })).toBeVisible();
    await expect(worker.locator('.catalog-grid--list')).toHaveCount(1);
    await worker.keyboard.press('Escape');
    await expect(worker).toHaveURL(/\/checkout\?view=list$/);
    await expect(requestable).toBeFocused();
    // The admin sidebar has eight destinations; reviews hang off Queue and Settings sits in the account menu.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/app/tools');
    for (const name of ['Queue', 'Inventory', 'Jobs', 'People', 'Foremen', 'Warehouses', 'Catalog', 'Activity']) {
      await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name, exact: true })).toBeInViewport({ ratio: 1 });
    }
    await page.getByRole('button', { name: 'Expand Hammer drill, 2 tools' }).click();
    await page.screenshot({ path: 'artifacts/parity-inventory-desktop.png', fullPage: true });
    await page.getByLabel('Search inventory').fill('TL-101');
    await chooseOption(page, 'Warehouse', fixture.warehouse.id);
    const filteredInventory = page.url();
    const row = page.getByRole('button', { name: 'Open Hammer drill, TL-101', exact: true });
    await row.click();
    const details = page.getByRole('dialog', { name: 'Hammer drill details', exact: true });
    await expect(details.getByRole('img', { name: 'Hammer drill product photo', exact: true })).toBeVisible();
    await expect(page.getByLabel('Search inventory')).toHaveValue('TL-101');
    await expect(page.getByRole('combobox', { name: 'Warehouse', exact: true })).toHaveText('Main warehouse');
    await page.screenshot({ path: 'artifacts/parity-tool-details-desktop.png', fullPage: true });
    await details.getByRole('button', { name: 'Edit', exact: true }).click();
    const edit = page.getByRole('dialog', { name: 'Edit Hammer drill', exact: true });
    await expect(edit.getByLabel('Serial number', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(edit).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(details).toHaveCount(0);
    await expect(page).toHaveURL(filteredInventory);
    await expect(row).toBeFocused();
    await expect(page.getByLabel('Search inventory')).toHaveValue('TL-101');
    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Warehouse', exact: true })).toHaveText('Main warehouse');
    await page.goto('/app/operations');
    const tabs = page.getByRole('tablist', { name: 'Queue filter', exact: true });
    const empty = page.getByText('Nothing waiting in this view. Requests and returns land here.', { exact: true });
    await tabs.getByRole('tab', { name: /^Requests/ }).click();
    await expect(empty).toBeVisible();
    await tabs.getByRole('tab', { name: /^Returns/ }).click();
    await expect(empty).toBeVisible();
    // A warehouse-to-person transfer is not a gate decision; it is listed in queue history.
    await tabs.getByRole('tab', { name: /^All waiting/ }).click();
    await expect(empty).toBeVisible();
    await tabs.getByRole('tab', { name: 'History', exact: true }).click();
    await expect(
      page.getByRole('region', { name: 'Transfers between people', exact: true }).getByText('Ray Torres'),
    ).not.toHaveCount(0);
  } finally {
    await workerContext.close();
  }
});
