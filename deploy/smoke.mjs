import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const origin = process.env.TEST_APP_URL;
const password = process.env.TEST_PASSWORD;
assert(origin?.startsWith('https://'), 'Set TEST_APP_URL to the trusted HTTPS origin.');
assert(password, 'Set TEST_PASSWORD to the seeded testing password.');
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ baseURL: origin, viewport: { width: 390, height: 844 } });
const page = await context.newPage();
page.setDefaultTimeout(20_000);
const browserErrors = [];
page.on('pageerror', (error) => browserErrors.push(error.message));

async function command(request, path, data) {
  const csrf = await (await request.get('/api/auth/csrf')).json();
  const response = await request.post(path, { data, headers: { Origin: origin, 'X-CSRFToken': csrf.csrf_token } });
  assert(response.ok(), `${path} returned HTTP ${response.status()}`);
  return response.json();
}
async function ensure(path, body, match) {
  const rows = (await (await page.request.get(path)).json()).items;
  return rows.find(match) ?? command(page.request, path, body);
}
async function emailLink(email, prefix) {
  let link;
  await expect
    .poll(
      async () => {
        const inbox = await (await fetch('http://127.0.0.1:8025/api/v1/messages?limit=100')).json();
        for (const message of inbox.messages ?? []) {
          if (!message.To?.some((to) => to.Address === email)) continue;
          const body = await (await fetch(`http://127.0.0.1:8025/api/v1/message/${message.ID}`)).json();
          link = (body.Text?.match(/https:\/\/[^\s<>]+/g) ?? []).find((url) =>
            new URL(url).pathname.startsWith(prefix),
          );
          if (link) return true;
        }
        return false;
      },
      { timeout: 30_000, message: 'Expected an account link in the private test inbox.' },
    )
    .toBe(true);
  assert.equal(new URL(link).origin, origin);
  return link;
}

try {
  assert.equal((await page.request.get('/healthz')).status(), 200);
  if (process.env.EXPECTED_RELEASE)
    assert.equal((await (await page.request.get('/__release')).text()).trim(), process.env.EXPECTED_RELEASE);
  assert.equal((await page.request.get('/api/me')).status(), 401);

  // A dedicated identity keeps CI independent of changes to human review accounts.
  const ownerEmail = 'deployment-checks@example.com';
  const setup = await browser.newContext({ baseURL: origin });
  const csrf = await (await setup.request.get('/api/auth/csrf')).json();
  const ownerLogin = await setup.request.post('/api/auth/sign-in', {
    data: { email: ownerEmail, password },
    headers: { Origin: origin, 'X-CSRFToken': csrf.csrf_token },
  });
  if (ownerLogin.status() === 401) {
    await command(setup.request, '/api/auth/signup', { email: ownerEmail, name: 'Deployment checks' });
    const verification = new URL(await emailLink(ownerEmail, '/verify-email'));
    await command(setup.request, '/api/auth/verify-signup', {
      token: verification.searchParams.get('token'),
      password,
    });
  } else assert.equal(ownerLogin.status(), 200);
  await command(setup.request, '/api/auth/sign-out', {});
  await setup.close();

  await page.goto('/login');
  assert.equal(await page.evaluate(() => window.isSecureContext && typeof crypto.randomUUID === 'function'), true);
  await page.getByLabel('Email address', { exact: true }).fill(ownerEmail);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/app/);
  const sessionCookie = (await context.cookies()).find((cookie) => cookie.name === 'sessionid');
  assert(sessionCookie?.secure && sessionCookie.httpOnly, 'Expected the real secure session cookie.');

  const company = await command(page.request, '/api/companies', {
    request_key: 'e37a519c-0a36-48c2-bd81-e83fc054b991',
    name: 'Deployment checks',
    preferred_name: 'Deployment checks',
  });
  const base = `/api/companies/${company.id}`;
  const warehouse = await ensure(
    `${base}/warehouses`,
    { code: 'CHECK', name: 'Deployment checks' },
    (v) => v.code === 'CHECK',
  );
  const category = await ensure(
    `${base}/tool-categories`,
    { name: 'Deployment checks' },
    (v) => v.name === 'Deployment checks',
  );
  const model = await ensure(
    `${base}/tool-models`,
    {
      category_id: category.id,
      name: 'Deployment photo check',
      manufacturer: 'Test fixture',
      model_number: 'CHECK',
    },
    (v) => v.model_number === 'CHECK',
  );
  await page.evaluate((id) => sessionStorage.setItem('nelson.company', id), company.id);
  await page.goto('/app/tools');
  let asset = (await (await page.request.get(`${base}/tools?search=PIPELINE-PHOTO-001`)).json()).items[0];
  if (!asset) {
    await page.goto('/app/tools/new');
    await page.getByLabel('Tool photo (up to 8 MB)').setInputFiles('e2e/fixtures/hammer-drill.jpg');
    await page.getByLabel('Tool model').selectOption(model.id);
    await page.getByLabel('Starting warehouse').selectOption(warehouse.id);
    await page.getByLabel('Unique asset tag').fill('PIPELINE-PHOTO-001');
    await page.getByRole('button', { name: 'Register tool', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Open its custody record' })).toBeVisible();
    asset = (await (await page.request.get(`${base}/tools?search=PIPELINE-PHOTO-001`)).json()).items[0];
  }
  assert(asset.registration_photo_id, 'Registration must retain the uploaded photo.');
  const photoPath = `${base}/files/${asset.registration_photo_id}`;
  const photo = await page.request.get(photoPath);
  assert.equal(photo.status(), 200);
  assert.deepEqual(await photo.body(), await readFile('e2e/fixtures/hammer-drill.jpg'));
  const anonymous = await browser.newContext({ baseURL: origin });
  assert.equal((await anonymous.request.get(photoPath)).status(), 401);
  await anonymous.close();
  await expect
    .poll(
      async () => (await (await page.request.get(`${base}/activity?search=PIPELINE-PHOTO-001`)).json()).items.length,
      { timeout: 30_000, message: 'The deployed audit worker must materialize the registration.' },
    )
    .toBeGreaterThan(0);
  await page.goto(`/app/tools/${asset.id}`);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({ path: 'artifacts/deployed-tool-mobile.png', fullPage: true });

  const email = `deploy-${randomUUID().slice(0, 12)}@example.com`;
  await command(page.request, `${base}/invitations`, {
    email,
    preferred_name: 'Deployment member',
    role: 'field_member',
  });
  const invitation = await emailLink(email, '/invite/');
  const memberContext = await browser.newContext({ baseURL: origin, viewport: { width: 390, height: 844 } });
  const member = await memberContext.newPage();
  member.setDefaultTimeout(20_000);
  await member.goto(invitation);
  await member.getByRole('link', { name: 'Create an account', exact: true }).click();
  await member.getByLabel('Your name', { exact: true }).fill('Deployment member');
  await member.getByLabel('Work email', { exact: true }).fill(email);
  await member.getByRole('button', { name: 'Send verification link' }).click();
  await expect(member.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await member.goto(await emailLink(email, '/verify-email'));
  await member.getByLabel('New password', { exact: true }).fill(password);
  await member.getByLabel('Confirm password', { exact: true }).fill(password);
  await member.getByRole('button', { name: 'Create account', exact: true }).click();
  await member.getByRole('button', { name: 'Accept invitation', exact: true }).click();
  await member.getByRole('button', { name: 'Open workspace', exact: true }).click();
  await expect(member.getByRole('heading', { name: 'My tools', exact: true })).toBeVisible();
  await member.goto('/forgot-password');
  await member.getByLabel('Email address', { exact: true }).fill(email);
  await member.getByRole('button', { name: 'Send reset link' }).click();
  await expect(member.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await member.goto(await emailLink(email, '/reset-password'));
  await member.getByLabel('New password', { exact: true }).fill(`${password}-reset`);
  await member.getByLabel('Confirm password', { exact: true }).fill(`${password}-reset`);
  await member.getByRole('button', { name: 'Update password', exact: true }).click();
  await expect(member.getByRole('heading', { name: 'Password updated', exact: true })).toBeVisible();
  await memberContext.close();

  await page.goto('/app/tools');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  const cdp = await context.newCDPSession(page);
  assert.deepEqual((await cdp.send('Page.getAppManifest')).errors, []);
  assert.deepEqual((await cdp.send('Page.getInstallabilityErrors')).installabilityErrors, []);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: 'artifacts/deployed-inventory-mobile.png', fullPage: true });
  assert.deepEqual(browserErrors, []);
  console.log(
    'Deployed HTTPS, secure login, email accounts, invitation/reset, private photo bytes, audit worker, and PWA checks passed.',
  );
  console.log(`Persistence record: company ${company.id}, asset ${asset.id}, photo ${asset.registration_photo_id}`);
} catch (error) {
  await page.screenshot({ path: 'artifacts/deployed-failure.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
