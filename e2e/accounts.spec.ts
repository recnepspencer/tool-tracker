import { test, expect, type Page } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const password = 'Real-browser-test-password-2026';
const mailDir = resolve('artifacts/mail');
async function emailLink(email: string, path: string) {
  let link = '';
  await expect
    .poll(async () => {
      for (const file of (await readdir(mailDir)).reverse()) {
        const body = await readFile(resolve(mailDir, file), 'utf8');
        if (body.includes(`To: ${email}`) && body.includes(path)) {
          const found = body.match(new RegExp(`https?://[^\\s]*${path}[^\\s]*`));
          if (found) {
            const url = new URL(found[0]);
            link = url.pathname + url.search;
            return true;
          }
        }
      }
      return false;
    })
    .toBe(true);
  return link;
}
async function signup(page: Page, email: string, name: string) {
  await page.getByLabel('Your name', { exact: true }).fill(name);
  await page.getByLabel('Work email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Send verification link' }).click();
  await expect(page.getByRole('status')).toContainText('Check your inbox');
  await page.goto(await emailLink(email, '/verify-email'));
  await page.getByLabel('New password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
}

test('verified signup, company, delivered invitation, real login and password recovery', async ({ page, browser }) => {
  const unique = crypto.randomUUID().slice(0, 8);
  const owner = `owner-${unique}@example.com`;
  const employee = `employee-${unique}@example.com`;
  await page.goto('/signup');
  await signup(page, owner, 'Company Owner');
  await expect(page).toHaveURL(/company-setup/);
  await page.getByLabel('Company name', { exact: true }).fill(`Browser Company ${unique}`);
  await page.getByLabel('Your name', { exact: true }).fill('Company Owner');
  await page.getByRole('button', { name: 'Create company', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tools', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Tools', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'People', exact: true }).click();
  // Sections are selected by their visible heading, rather than internal component names.
  const form = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Invite a teammate' }) });
  await form.getByLabel('Name', { exact: true }).fill('Field Employee');
  await form.getByLabel('Email address', { exact: true }).fill(employee);
  await form.getByRole('button', { name: 'Send invitation' }).click();
  await expect(page.getByText('Invitation sent.', { exact: false })).toBeVisible();
  const invitation = await emailLink(employee, '/invite/');
  const workerContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 390, height: 844 },
  });
  const worker = await workerContext.newPage();
  await worker.goto(invitation);
  await expect(worker.getByText(employee, { exact: true })).toBeVisible();
  await worker.getByRole('link', { name: 'Create an account', exact: true }).click();
  await signup(worker, employee, 'Field Employee');
  await expect(worker.getByRole('button', { name: 'Accept invitation' })).toBeVisible();
  await worker.getByRole('button', { name: 'Accept invitation' }).click();
  await expect(worker.getByRole('heading', { name: 'Tools', exact: true })).toBeVisible();
  await expect(worker.getByText('Choose your profile')).toHaveCount(0);
  // Build an inventory through the same public screens a new company uses.
  await page.goto('/app/catalog');
  const section = (name: string) =>
    page.locator('section').filter({ has: page.getByRole('heading', { name, exact: true }) });
  await section('Add warehouse').getByLabel('Code', { exact: true }).fill('MAIN');
  await section('Add warehouse').getByLabel('Name', { exact: true }).fill('Main warehouse');
  await section('Add warehouse').getByRole('button', { name: 'Create warehouse' }).click();
  await expect(section('Add warehouse').getByRole('status')).toContainText('Saved successfully');
  await section('Add category').getByLabel('Category name').fill('Drills');
  await section('Add category').getByRole('button', { name: 'Create category' }).click();
  await expect(section('Add category').getByRole('status')).toContainText('Saved successfully');
  await section('Add model').getByLabel('Category', { exact: true }).selectOption({ label: 'Drills' });
  await section('Add model').getByLabel('Tool name').fill('Hammer drill');
  await section('Add model').getByLabel('Manufacturer').fill('Makita');
  await section('Add model').getByLabel('Model number').fill('XPH14');
  await section('Add model').getByRole('button', { name: 'Create model' }).click();
  await expect(section('Add model').getByRole('status')).toContainText('Saved successfully');
  await page.goto('/app/tools/new');
  await page.getByLabel('Tool model').selectOption({ label: 'Makita Hammer drill · XPH14' });
  await page.getByLabel('Starting warehouse').selectOption({ label: 'Main warehouse' });
  await page.getByLabel('Unique asset tag').fill('TEST-001');
  await page.getByRole('button', { name: 'Register tool', exact: true }).click();
  await expect(page.getByText('Tool registered.', { exact: false })).toBeVisible();
  await worker.goto('/app/tools');
  await worker.getByRole('link', { name: /TEST-001/ }).click();
  await worker.getByRole('button', { name: 'Request tool', exact: true }).click();
  await expect(worker.getByRole('status')).toContainText('Saved successfully');
  await page.goto('/app/operations');
  await page.getByRole('button', { name: 'Apply decision' }).click();
  await expect(page.getByText('approved', { exact: true })).toBeVisible();
  await worker.goto('/app/operations');
  await worker.getByRole('button', { name: 'Confirm handoff decision' }).click();
  await expect(worker.getByText('No handoffs to review.')).toBeVisible();
  await worker.goto('/app/tools');
  await worker.getByRole('link', { name: /TEST-001/ }).click();
  await expect(
    worker
      .locator('section')
      .filter({ has: worker.getByRole('heading', { name: 'Current custody' }) })
      .getByText('Field Employee', { exact: true }),
  ).toBeVisible();
  await page.goto('/app/jobs');
  await page.getByText('Create a project or job', { exact: true }).click();
  await section('New project').getByLabel('Project number').fill('P-001');
  await section('New project').getByLabel('Project name').fill('Library');
  await section('New project').getByRole('button', { name: 'Create project' }).click();
  await expect(section('New project').getByRole('status')).toContainText('Saved successfully');
  await section('New job').getByLabel('Project', { exact: true }).selectOption({ label: 'P-001 · Library' });
  await section('New job').getByLabel('Job number').fill('J-001');
  await section('New job').getByLabel('Job name').fill('Library wiring');
  await section('New job').getByRole('button', { name: 'Create job' }).click();
  await expect(page.getByRole('heading', { name: 'Library wiring', exact: true })).toBeVisible();
  await page.getByText('Assign a person', { exact: true }).click();
  await page.getByLabel('Person', { exact: true }).selectOption({ label: 'Field Employee' });
  await page.getByLabel('Responsibility', { exact: true }).selectOption('foreman');
  await page.getByLabel('Reason', { exact: true }).fill('Lead the wiring crew');
  await page.getByRole('button', { name: 'Save assignment' }).click();
  await worker.goto('/app/jobs');
  await expect(worker.getByText('Field Employee', { exact: true }).last()).toBeVisible();
  await expect(worker.getByText(/foreman ·/)).toBeVisible();
  const credentials = await worker.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
  expect(JSON.stringify(credentials)).not.toContain(password);
  await worker.screenshot({ path: 'artifacts/real-app-mobile.png', fullPage: true });
  await worker.goto('/forgot-password');
  await worker.getByLabel('Email address', { exact: true }).fill(employee);
  await worker.getByRole('button', { name: 'Send reset link' }).click();
  await expect(worker.getByRole('status')).toContainText('If an account exists');
  const reset = await emailLink(employee, '/reset-password');
  await worker.goto(reset);
  await worker.getByLabel('New password', { exact: true }).fill(password + '-updated');
  await worker.getByLabel('Confirm password', { exact: true }).fill(password + '-updated');
  await worker.getByRole('button', { name: 'Update password' }).click();
  await expect(worker.getByText('Your password has been updated.', { exact: false })).toBeVisible();
  await worker.getByRole('link', { name: 'Sign in', exact: true }).click();
  await worker.getByLabel('Email address', { exact: true }).fill(employee);
  await worker.getByLabel('Password', { exact: true }).fill(password);
  await worker.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(worker.getByRole('alert')).toBeVisible();
  await worker.getByLabel('Password', { exact: true }).fill(password + '-updated');
  await worker.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(worker.getByRole('heading', { name: 'Tools', exact: true })).toBeVisible();
  await worker.getByRole('button', { name: 'Open navigation' }).click();
  await worker.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(worker.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await worker.goto('/app/tools');
  await expect(worker).toHaveURL(/login/);
  await workerContext.close();
});

test('mobile login is accessible and the installed shell never caches API responses', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('autocomplete', 'current-password');
  await page.screenshot({ path: 'artifacts/real-login-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  const cached = await page.evaluate(async () => {
    const all = await Promise.all(
      (await caches.keys()).map(async (key) => (await (await caches.open(key)).keys()).map((r) => r.url)),
    );
    return all.flat();
  });
  expect(cached.length).toBeGreaterThan(0);
  expect(cached.some((url) => new URL(url).pathname.startsWith('/api/'))).toBe(false);
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('You’re offline.', { exact: false })).toBeVisible();
  await page.getByLabel('Email address', { exact: true }).fill('offline@example.com');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert').last()).toContainText('offline');
  await context.setOffline(false);
});
