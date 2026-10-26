import { test, expect, type Page } from '@playwright/test';
import { password, emailLink } from './support';

async function signup(page: Page, email: string, name: string) {
  await page.getByLabel('Your name', { exact: true }).fill(name);
  await page.getByLabel('Work email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Send verification link' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText(email);
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
  await expect(page.getByRole('heading', { name: 'Queue', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Queue', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'People', exact: true }).click();
  // Sections are selected by their visible heading, rather than internal component names.
  await page.getByRole('button', { name: 'Invite person', exact: true }).click();
  const form = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Invite a teammate' }) });
  await form.getByLabel('Name', { exact: true }).fill('Field Employee');
  await form.getByLabel('Email address', { exact: true }).fill(employee);
  await form.getByRole('button', { name: 'Send invitation' }).click();
  await expect(page.getByText('Invitation sent.', { exact: false })).toBeVisible();
  const invitation = await emailLink(employee, '/invite/');
  await page.getByRole('button', { name: 'Close invite a teammate' }).click();
  // A different signed-in user must explicitly switch accounts, preserving the invite.
  const wrongAccountContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const wrongAccount = await wrongAccountContext.newPage();
  await wrongAccount.goto('/login');
  await wrongAccount.getByLabel('Email address', { exact: true }).fill(owner);
  await wrongAccount.getByLabel('Password', { exact: true }).fill(password);
  await wrongAccount.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(wrongAccount).toHaveURL(/app/);
  await wrongAccount.goto(invitation);
  await expect(wrongAccount.getByRole('status')).toContainText(owner);
  await expect(wrongAccount.getByRole('button', { name: 'Accept invitation' })).toHaveCount(0);
  await wrongAccount.getByRole('button', { name: 'Switch account' }).click();
  await expect(wrongAccount).toHaveURL(new RegExp(`login\\?next=${encodeURIComponent(invitation)}`));
  await wrongAccountContext.close();
  const workerContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 390, height: 844 },
  });
  const worker = await workerContext.newPage();
  await worker.goto(invitation);
  await expect(worker.getByText(employee, { exact: true })).toBeVisible();
  await worker.screenshot({ path: 'artifacts/auth-invitation-mobile.png', fullPage: true });
  await worker.getByRole('link', { name: 'Create an account', exact: true }).click();
  await signup(worker, employee, 'Field Employee');
  await expect(worker.getByRole('button', { name: 'Accept invitation' })).toBeVisible();
  await worker.getByRole('button', { name: 'Accept invitation' }).click();
  await expect(worker.getByRole('heading', { name: 'Invitation accepted' })).toBeVisible();
  await worker.screenshot({ path: 'artifacts/auth-invitation-accepted-mobile.png', fullPage: true });
  await worker.getByRole('button', { name: 'Open workspace', exact: true }).click();
  await expect(worker.getByRole('heading', { name: 'My tools', exact: true })).toBeVisible();
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
  await page.getByRole('button', { name: 'Review request', exact: true }).click();
  await page.getByRole('button', { name: 'Apply decision' }).click();
  await expect(page.getByText('approved', { exact: true })).toBeVisible();
  await worker.goto('/app/operations');
  await worker.getByRole('button', { name: 'Review handoff', exact: true }).click();
  await worker.getByRole('button', { name: 'Confirm handoff decision' }).click();
  await expect(worker.getByText('No handoffs to review.')).toBeVisible();
  await worker.goto('/app/tools');
  await worker.getByRole('link', { name: /TEST-001/ }).click();
  await expect(
    worker.getByRole('region', { name: 'Current custody', exact: true }).getByText('Field Employee', { exact: true }),
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
  await worker.screenshot({ path: 'artifacts/auth-new-password-mobile.png', fullPage: true });
  await worker.getByLabel('New password', { exact: true }).fill(password + '-updated');
  await worker.getByLabel('Confirm password', { exact: true }).fill(password + '-updated');
  await worker.getByRole('button', { name: 'Update password' }).click();
  await expect(worker.getByText('Your password has been updated.', { exact: false })).toBeVisible();
  await worker.screenshot({ path: 'artifacts/auth-password-updated-mobile.png', fullPage: true });
  await worker.getByRole('link', { name: 'Sign in', exact: true }).click();
  await worker.getByLabel('Email address', { exact: true }).fill(employee);
  await worker.getByLabel('Password', { exact: true }).fill(password);
  await worker.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(worker.getByRole('alert')).toBeVisible();
  await worker.getByLabel('Password', { exact: true }).fill(password + '-updated');
  await worker.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(worker.getByRole('heading', { name: 'My tools', exact: true })).toBeVisible();
  await worker.getByRole('button', { name: 'Open navigation' }).click();
  await worker.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(worker.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await worker.goto('/app/tools');
  await expect(worker).toHaveURL(/login/);
  await workerContext.close();
});

test('mobile login is accessible and the installed shell never caches API responses', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
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

test('account links, resend, password validation, and recovery have actionable states', async ({ page }) => {
  const email = `account-states-${crypto.randomUUID().slice(0, 8)}@example.com`;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install();
  await page.goto('/signup');
  await page.getByLabel('Your name', { exact: true }).fill('Account Test');
  await page.getByLabel('Work email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Send verification link' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Resend email in/ })).toBeDisabled();
  await page.screenshot({ path: 'artifacts/auth-email-sent-mobile.png', fullPage: true });
  await page.clock.runFor(31_000);
  await page.getByRole('button', { name: 'Resend email', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('another verification link');
  await page.getByRole('button', { name: 'Use a different email' }).click();
  await expect(page.getByLabel('Work email', { exact: true })).toHaveValue(email);
  await expect(page.getByLabel('Your name', { exact: true })).toHaveValue('Account Test');

  const verification = await emailLink(email, '/verify-email');
  await page.goto(verification);
  await page.getByLabel('New password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Show new password', exact: true }).click();
  await expect(page.getByLabel('New password', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide new password', exact: true }).click();
  await page.getByLabel('Confirm password', { exact: true }).fill(password + '-mismatch');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Passwords do not match.');
  await expect(page.getByRole('alert')).toBeFocused();
  await expect(page.getByLabel('New password', { exact: true })).toHaveValue(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/company-setup/);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/login/);
  await page.goto(verification);
  await page.getByLabel('New password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Verification link unavailable' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Request a new verification link' })).toBeVisible();

  await page.goto(`/reset-password?email=${encodeURIComponent(email)}&token=invalid-link`);
  await page.getByLabel('New password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('alert')).toContainText('request a new link');
  await page.getByRole('link', { name: 'Request a new reset link' }).click();
  await expect(page.getByLabel('Email address', { exact: true })).toHaveValue(email);
  await page.goto('/reset-password');
  await expect(page.getByRole('heading', { name: 'Reset link unavailable' })).toBeVisible();
  await page.goto('/invite/an-invalid-invitation');
  await expect(page.getByRole('heading', { name: 'Invitation unavailable' })).toBeVisible();
  await expect(page.getByText(/ask your manager for a new invitation/)).toBeVisible();
  await page.screenshot({ path: 'artifacts/auth-invitation-unavailable-mobile.png', fullPage: true });
});
