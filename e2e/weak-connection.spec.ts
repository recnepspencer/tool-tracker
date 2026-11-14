import { expect } from '@playwright/test';
import { workspace, test } from './support';

test('saved records stand in for the server on a weak or lost connection', async ({ page, context }) => {
  await workspace(page);
  await page.goto('/app/tools');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const tools = page.getByRole('button', { name: 'Expand Hammer drill, 2 tools', exact: true });
  const saved = page.getByRole('status').filter({ hasText: 'Showing records saved' });
  await expect(tools).toBeVisible();
  // A good connection always shows the server's answer, never saved records.
  await expect(saved).toHaveCount(0);

  // The server is slow to answer: saved records appear, then the fresh answer replaces them.
  let answer!: () => void;
  const slow = new Promise<void>((resolve) => (answer = resolve));
  const toolList = /\/api\/companies\/[^/]+\/tools\?/;
  await page.route(toolList, async (route) => {
    await slow;
    await route.continue();
  });
  await page.reload();
  await expect(tools).toBeVisible();
  await expect(saved).toContainText('Weak connection. Showing records saved');
  answer();
  await expect(saved).toHaveCount(0);
  await expect(tools).toBeVisible();
  await page.unroute(toolList);

  // No connection at all: the installed app opens with the saved records.
  await context.setOffline(true);
  await page.reload();
  await expect(tools).toBeVisible();
  await expect(saved).toContainText('You’re offline. Showing records saved');
  await context.setOffline(false);
  await expect(saved).toHaveCount(0);
});
