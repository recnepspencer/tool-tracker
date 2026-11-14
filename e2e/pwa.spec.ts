import { expect } from '@playwright/test';
import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { workspace, test } from './support';

test('a real worker update reloads each tab only when no work is lost', async ({ page, context }) => {
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
  // A marker survives only as long as the page is not reloaded.
  const watch = () => {
    Reflect.set(window, 'beforeUpdate', true);
    navigator.serviceWorker.addEventListener('controllerchange', () => Reflect.set(window, 'updated', true));
  };
  await page.evaluate(watch);
  await otherTab.evaluate(watch);
  const unreloaded = (tab: typeof page) => tab.evaluate(() => Reflect.get(window, 'beforeUpdate') === true);
  const hide = (tab: typeof page) =>
    tab.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
  await profile.getByLabel('Company name').fill('Saved through the update');
  const ownedBuild = process.env.NELSON_BROWSER_DIST;
  if (!ownedBuild) throw new Error('The PWA journey requires the isolated browser build.');
  await appendFile(
    resolve(ownedBuild, 'sw.js'),
    `
// Update journey ${crypto.randomUUID()}
`,
  );
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.ready).update();
  });
  await page.waitForFunction(() => Reflect.get(window, 'updated') === true);
  await otherTab.waitForFunction(() => Reflect.get(window, 'updated') === true);
  // No prompt: the new release has taken over, and the tab with a draft keeps it on screen.
  await expect(page.getByRole('button', { name: 'Update app' })).toHaveCount(0);
  expect(await unreloaded(page)).toBe(true);
  await expect(profile.getByLabel('Company name')).toHaveValue('Saved through the update');
  // Switching away mid-edit does not reload either.
  await hide(page);
  expect(await unreloaded(page)).toBe(true);
  await expect(profile.getByLabel('Company name')).toHaveValue('Saved through the update');
  // The untouched tab reloads as soon as it is in the background.
  // The reload can tear down the evaluation that caused it.
  await Promise.all([otherTab.waitForEvent('load'), hide(otherTab).catch(() => undefined)]);
  expect(await unreloaded(otherTab)).toBe(false);
  await expect(otherTab.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/pwa-update-mobile.png', fullPage: true, animations: 'disabled' });
  await profile.getByRole('button', { name: 'Save company', exact: true }).click();
  await expect
    .poll(async () => (await (await page.request.get(fixture.base)).json()).name)
    .toBe('Saved through the update');
  // Leaving the page is the other safe moment.
  await page.setViewportSize({ width: 1280, height: 900 });
  await Promise.all([page.waitForEvent('load'), page.getByRole('link', { name: 'Inventory', exact: true }).click()]);
  await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();
  expect(await unreloaded(page)).toBe(false);
  expect(await page.evaluate(async () => (await navigator.serviceWorker.ready).waiting === null)).toBe(true);
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
  const install = page.getByRole('button', { name: 'Install Tool Tracker', exact: true });
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
