import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { command, workspace, emailLink, password } from './support';

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
    await command(worker.request, '/api/auth/signup', { email, name: 'Ray Torres' });
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
    await expect(worker.getByRole('link', { name: 'TL-101 Hammer drill' })).toBeVisible();
    await expect(worker.getByText('Awaiting acceptance', { exact: true })).toBeVisible();
    await expect(worker.locator('.worker-tool-row img')).toBeVisible();
    expect(await worker.locator('.experience').evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
      'rgb(6, 8, 12)',
    );
    expect(
      await worker.locator('.worker-main').evaluate((element) => Math.round(element.getBoundingClientRect().width)),
    ).toBe(520);
    expect(
      await worker
        .locator('.worker-tool-row .tool-photo')
        .evaluate((element) => Math.round(element.getBoundingClientRect().width)),
    ).toBe(62);
    await worker.screenshot({ path: 'artifacts/parity-worker-desktop.png', fullPage: true });
    await worker.setViewportSize({ width: 390, height: 844 });
    await worker.screenshot({ path: 'artifacts/parity-worker-mobile.png', fullPage: true });
    expect(await worker.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await worker.getByRole('link', { name: 'Transfer', exact: true }).click();
    await expect(worker.getByRole('dialog', { name: 'Tool details' })).toBeVisible();
    await expect(worker.getByRole('region', { name: 'Transfer or return' })).toBeVisible();
    await worker.keyboard.press('Escape');
    await expect(worker.getByRole('dialog')).toHaveCount(0);
    await worker.getByRole('link', { name: 'Need something else? Browse checkout' }).click();
    await expect(worker.getByRole('heading', { name: 'Checkout', exact: true })).toBeVisible();
    await worker.getByRole('button', { name: 'List', exact: true }).click();
    await expect(worker.getByRole('button', { name: 'List', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await worker.screenshot({ path: 'artifacts/parity-checkout-mobile.png', fullPage: true });
    await page.goto('/app/tools');
    for (const name of [
      'Queue',
      'Inventory',
      'Damaged & lost',
      'People',
      'Foremen',
      'Warehouses',
      'Access',
      'Activity',
      'Settings',
    ]) {
      await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name, exact: true })).toBeInViewport();
    }
    await page.getByRole('button', { name: 'Expand Hammer drill, 2 tools' }).click();
    await page.screenshot({ path: 'artifacts/parity-inventory-desktop.png', fullPage: true });
    await page.goto('/app/operations');
    await page.getByRole('button', { name: 'Requests', exact: true }).click();
    await expect(page.getByText('No handoffs to review.')).toBeVisible();
    await page.getByRole('button', { name: 'Returns', exact: true }).click();
    await expect(page.getByText('No handoffs to review.')).toBeVisible();
    await page.getByRole('button', { name: 'All waiting', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Review handoff', exact: true })).toBeVisible();
  } finally {
    await workerContext.close();
  }
});
