import { test, expect } from '@playwright/test';
import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { workspace } from './support';

test.use({ actionTimeout: 15_000 });

test('a real worker update preserves drafts until each tab accepts a reload', async ({ page, context }) => {
  const fixture = await workspace(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/settings');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const profile = page.getByRole('region', { name: 'Company profile', exact: true });
  await expect(profile.getByLabel('Company name')).toHaveValue(fixture.company.name);
  const cdp = await context.newCDPSession(page);
  const manifest = await cdp.send('Page.getAppManifest');
  expect(manifest.errors).toEqual([]);
  expect(JSON.parse(manifest.data!)).toMatchObject({ display: 'standalone', start_url: '/app', scope: '/' });
  expect((await cdp.send('Page.getInstallabilityErrors')).installabilityErrors).toEqual([]);
  const otherTab = await context.newPage();
  await otherTab.goto('/app/tools');
  await otherTab.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await profile.getByLabel('Company name').fill('Saved through the update');
  const ownedBuild = process.env.NELSON_BROWSER_DIST;
  if (!ownedBuild) throw new Error('The PWA journey requires the isolated browser build.');
  await appendFile(resolve(ownedBuild, 'sw.js'), `\n// Update journey ${crypto.randomUUID()}\n`);
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.ready).update();
  });
  const update = page.getByRole('button', { name: 'Update app', exact: true });
  await expect(update).toBeVisible();
  await expect(otherTab.getByRole('button', { name: 'Update app', exact: true })).toBeVisible();
  await otherTab.getByRole('button', { name: 'Later', exact: true }).click();
  await otherTab.getByRole('button', { name: 'Expand Hammer drill, 2 tools', exact: true }).click();
  await otherTab.getByRole('link', { name: /UNIT-001/ }).click();
  await otherTab.getByRole('button', { name: 'Manage this tool', exact: true }).click();
  const details = otherTab.getByRole('region', { name: 'Asset information', exact: true });
  await details.getByLabel('Serial number', { exact: true }).fill('OTHER-TAB-DRAFT');
  await expect(profile.getByLabel('Company name')).toHaveValue('Saved through the update');
  expect((await (await page.request.get(fixture.base)).json()).name).toBe(fixture.company.name);
  await page.screenshot({ path: 'artifacts/pwa-update-mobile.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Later', exact: true }).click();
  await expect(update).toHaveCount(0);
  await expect(profile.getByLabel('Company name')).toHaveValue('Saved through the update');
  expect(await page.evaluate(async () => Boolean((await navigator.serviceWorker.ready).waiting))).toBe(true);
  await profile.getByRole('button', { name: 'Save company', exact: true }).click();
  await expect(profile.getByRole('status')).toBeVisible();
  await page.reload();
  await expect(profile.getByLabel('Company name')).toHaveValue('Saved through the update');
  await expect(update).toBeVisible();
  await Promise.all([page.waitForEvent('load'), update.click()]);
  await expect(profile.getByLabel('Company name')).toHaveValue('Saved through the update');
  await expect(update).toHaveCount(0);
  expect(await page.evaluate(async () => (await navigator.serviceWorker.ready).waiting === null)).toBe(true);
  await expect(details.getByLabel('Serial number', { exact: true })).toHaveValue('OTHER-TAB-DRAFT');
  await details.getByRole('button', { name: 'Save tool details', exact: true }).click();
  await expect(details.getByRole('status')).toBeVisible();
  await otherTab.keyboard.press('Escape');
  const otherUpdate = otherTab.getByRole('button', { name: 'Update app', exact: true });
  await expect(otherUpdate).toBeVisible();
  await Promise.all([otherTab.waitForEvent('load'), otherUpdate.click()]);
  await otherTab.goto(`/app/tools/${fixture.asset.id}?action=manage`);
  await expect(details.getByLabel('Serial number', { exact: true })).toHaveValue('OTHER-TAB-DRAFT');
  await expect(otherUpdate).toHaveCount(0);
  const cached = await page.evaluate(async () =>
    (
      await Promise.all(
        (await caches.keys()).map(async (key) => (await (await caches.open(key)).keys()).map((request) => request.url)),
      )
    ).flat(),
  );
  expect(cached.length).toBeGreaterThan(0);
  expect(cached.some((url) => new URL(url).pathname.startsWith('/api/'))).toBe(false);
});

test('the install-event boundary handles dismissal, appinstalled and prompt failure', async ({ page }) => {
  // Supplied browser events prove the app's event handling, not a native OS install.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  const offer = async (reject = false) =>
    page.evaluate((reject) => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      Object.assign(event, {
        prompt: async () => {
          Reflect.set(window, 'installPromptCalls', (Reflect.get(window, 'installPromptCalls') ?? 0) + 1);
          if (reject) throw new Error('Browser prompt unavailable');
        },
        userChoice: Promise.resolve({ outcome: 'dismissed' }),
      });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    }, reject);
  const install = page.getByRole('button', { name: 'Install Nelson Electric', exact: true });
  expect(await offer()).toBe(true);
  await expect(install).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss install offer', exact: true }).click();
  await expect(install).toHaveCount(0);
  expect(await page.evaluate(() => Reflect.get(window, 'installPromptCalls') ?? 0)).toBe(0);
  await offer();
  await install.click();
  await expect(install).toHaveCount(0);
  expect(await page.evaluate(() => Reflect.get(window, 'installPromptCalls'))).toBe(1);
  await offer();
  await expect(install).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await expect(install).toHaveCount(0);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await offer(true);
  await install.click();
  await expect(install).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('browser menu');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/pwa-install-fallback-mobile.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Dismiss installation message', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(errors).toEqual([]);
});
