import { expect, type Page } from '@playwright/test';
import { layoutProblems } from './layout-audit';
import { invitedMember, test, workspace } from './support';

// Measure finished layouts, not frames of an entrance animation.
test.use({ reducedMotion: 'reduce' });

const desktop = { width: 1280, height: 900 };
const phone = { width: 390, height: 844 };

async function settled(page: Page) {
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await expect(page.getByText('Loading…', { exact: true })).toHaveCount(0);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

/** Visit each screen (and run each step) at this size, collecting every problem before failing. */
async function audit(page: Page, screens: (string | [string, (page: Page) => Promise<unknown>])[], touch = false) {
  const found: string[] = [];
  for (const screen of screens) {
    const [url, step] = typeof screen === 'string' ? [screen] : screen;
    await page.goto(url);
    await settled(page);
    if (step) await step(page);
    const label = `${url}${step ? ` (${step.name})` : ''}`;
    found.push(...(await layoutProblems(page, { touch })).map((problem) => `${label}: ${problem}`));
  }
  expect(found).toEqual([]);
}

const ownerScreens = [
  '/app/operations',
  '/app/tools',
  '/app/tools/new',
  '/app/flagged',
  '/app/mine',
  '/app/checkout',
  '/app/directory',
  '/app/jobs',
  '/app/people',
  '/app/access',
  '/app/warehouses',
  '/app/catalog',
  '/app/reconciliations',
  '/app/activity',
  '/app/settings',
];

const dialog = (name: string | RegExp, opener: string) =>
  async function open(page: Page) {
    await page.getByRole('button', { name: opener, exact: true }).filter({ visible: true }).click();
    await expect(page.getByRole('dialog', { name })).toBeVisible();
  };

test('an owner’s screens line up on a desktop', async ({ page }) => {
  await page.setViewportSize(desktop);
  const { asset } = await workspace(page);
  await audit(page, [...ownerScreens, `/app/tools/${asset.id}`, ['/app/jobs', dialog('Add job', 'Add job')]]);
});

test('an owner’s screens line up on a phone', async ({ page }) => {
  await page.setViewportSize(phone);
  const { asset } = await workspace(page);
  await audit(page, [...ownerScreens, `/app/tools/${asset.id}`, ['/app/tools', dialog('Menu', 'Menu')]], true);
});

test('a field member’s screens line up on a phone', async ({ page, browser }) => {
  const fixture = await workspace(page);
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:4173',
    viewport: phone,
    reducedMotion: 'reduce',
  });
  const worker = await context.newPage();
  try {
    await invitedMember(page, worker, fixture.base, 'field_member');
    await audit(
      worker,
      [
        '/app/mine',
        '/app/checkout',
        `/app/checkout/${fixture.asset.id}`,
        '/app/jobs',
        '/app/activity',
        '/app/settings',
        ['/app/mine', dialog('Menu', 'Menu')],
      ],
      true,
    );
  } finally {
    await context.close();
  }
});

// The audit passing means nothing unless it still sees what it is meant to see.
test('the audit reports each kind of layout problem', async ({ page }) => {
  await page.setViewportSize(phone);
  await page.goto('/login');
  await settled(page);
  await page.evaluate(() => {
    const plus = '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M5 12h14M12 5v14"/></svg>';
    const bench = document.createElement('div');
    bench.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;background:#000;padding:8px;display:grid;gap:40px;align-content:start';
    bench.innerHTML = `
      <div><button class="button button--primary" style="display:inline-block">${plus} Add job</button></div>
      <div style="display:flex;gap:8px;align-items:flex-start"><button class="button">Tall</button><button class="button" style="min-height:30px">Short</button></div>
      <div><button style="width:60px;height:30px">One</button><button style="width:60px;height:30px;margin-left:-20px">Two</button></div>
      <div style="display:flex;gap:4px"><button style="width:16px;height:16px"></button><button style="width:16px;height:16px"></button></div>
      <div style="overflow:hidden;width:40px;white-space:nowrap">A label far too long for its box</div>
      <div><button class="button">Save</button><div style="border:1px solid #888;height:60px">Card under a button</div></div>`;
    (document.querySelector('main') ?? document.body).append(bench);
  });
  const problems = (await layoutProblems(page, { touch: true })).join('\n');
  expect(problems).toMatch(/"Add job": its icon sits [\d.]+px (above|below) the label/);
  expect(problems).toMatch(/"Tall" is [\d.]+px tall beside .*"Short"/);
  expect(problems).toMatch(/"One" overlaps .*"Two"/);
  expect(problems).toMatch(/is only 16px by 16px to tap, too close to another target/);
  expect(problems).toMatch(/"A label far too long for its box" cuts off/);
  expect(problems).toMatch(/"Card under a button" is only 0px from button.button "Save"/);
});

for (const [size, viewport] of [
  ['desktop', desktop],
  ['phone', phone],
] as const)
  test(`the signed-out screens line up on a ${size}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await audit(page, ['/login', '/signup', '/forgot-password'], size === 'phone');
  });
