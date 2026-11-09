import { expect, type Page } from '@playwright/test';
import { password, command, emailLink, chooseOption, invitedMember, ownedCompany, signupCode, test } from './support';

async function signup(page: Page, email: string, name: string, company?: string) {
  if (company) {
    await page.getByLabel('Signup code', { exact: true }).fill(signupCode());
    await page.getByLabel('Company name', { exact: true }).fill(company);
  }
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

test('verified signup, company setup and an invitation accepted across accounts', async ({ page, browser }) => {
  const unique = crypto.randomUUID().slice(0, 8);
  const owner = `owner-${unique}@example.com`;
  const employee = `employee-${unique}@example.com`;
  await page.goto('/signup?as=company');
  await signup(page, owner, 'Company Owner', `Browser Company ${unique}`);
  await expect(page).toHaveURL(/company-setup/);
  // The details entered at signup carry over, and the claimed code needs no re-entry.
  await expect(page.getByLabel('Company name', { exact: true })).toHaveValue(`Browser Company ${unique}`);
  await expect(page.getByLabel('Your name', { exact: true })).toHaveValue('Company Owner');
  await expect(page.getByLabel('Signup code', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Create company', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Queue', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Queue', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'People', exact: true }).click();
  await page.getByRole('button', { name: 'Invite person', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Invite a person', exact: true });
  await form.getByLabel('Name', { exact: true }).fill('Field Employee');
  await form.getByLabel('Email address', { exact: true }).fill(employee);
  await form.getByRole('button', { name: 'Create invitation', exact: true }).click();
  await expect(form.getByText('We emailed the invitation.', { exact: false })).toBeVisible();
  const invitation = await emailLink(employee, '/invite/');
  await expect(form.getByRole('link', { name: 'View invitation', exact: true })).toHaveAttribute(
    'href',
    new URL(invitation, 'http://127.0.0.1:4173').pathname,
  );
  await form.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(form).toHaveCount(0);
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
  await workerContext.close();
});

test('signup separates joining a team from starting a company', async ({ page, browser }) => {
  const { base, company } = await ownedCompany(page);
  const email = `rejoin-${crypto.randomUUID().slice(0, 8)}@example.com`;
  const first = await command(page.request, `${base}/invitations`, {
    email,
    preferred_name: 'Rejoin Person',
    role: 'field_member',
  });
  const visitorContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const visitor = await visitorContext.newPage();
  await visitor.goto('/signup');
  await expect(visitor.getByRole('heading', { name: 'Create an account' })).toBeVisible();
  await expect(visitor.getByText('Tool Tracker', { exact: true })).toBeVisible();
  await expect(visitor).toHaveTitle('Create an account · Tool Tracker');
  await visitor.getByRole('link', { name: /I’m starting a company/ }).click();
  await expect(visitor.getByLabel('Signup code', { exact: true })).toBeVisible();
  await visitor.getByRole('link', { name: 'Find your invitation', exact: true }).click();
  await expect(visitor.getByRole('heading', { name: 'Find your invitation' })).toBeVisible();
  await expect(visitor.getByLabel('Signup code', { exact: true })).toHaveCount(0);
  await visitor.getByLabel('Work email', { exact: true }).fill(email);
  await visitor.getByRole('button', { name: 'Email my invitation', exact: true }).click();
  await expect(visitor.getByRole('status')).toContainText(email);
  // The re-sent invitation carries a fresh link; the first one stops working.
  await expect.poll(() => emailLink(email, '/invite/')).not.toBe(`/invite/${first.token}`);
  await visitor.goto(await emailLink(email, '/invite/'));
  await expect(visitor.getByText(company.name, { exact: true })).toBeVisible();
  await visitor.getByRole('link', { name: 'Create an account', exact: true }).click();
  await expect(visitor.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await expect(visitor.getByLabel('Signup code', { exact: true })).toHaveCount(0);
  await visitorContext.close();
});

test('a signup code starts a company with its logo and hands ownership to a named owner', async ({ page, browser }) => {
  const unique = crypto.randomUUID().slice(0, 8);
  const founder = `founder-${unique}@example.com`;
  const boss = `boss-${unique}@example.com`;
  await page.goto('/signup');
  await page.getByRole('link', { name: /I’m starting a company/ }).click();
  await expect(page.getByRole('heading', { name: 'Set up your company' })).toBeVisible();
  await page.getByLabel('Signup code', { exact: true }).fill('ZZZZ-ZZZZ-ZZZZ');
  await page.getByLabel('Your name', { exact: true }).fill('Office Manager');
  await page.getByLabel('Work email', { exact: true }).fill(founder);
  await page.getByLabel('Company name', { exact: true }).fill(`Logo Company ${unique}`);
  await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/hammer-drill.jpg');
  // The logo's shape, size and position are chosen before it is used.
  const cropper = page.getByRole('group', { name: 'Adjust company logo' });
  await cropper.getByRole('button', { name: 'Square', exact: true }).click();
  await cropper.getByRole('button', { name: 'Fill frame', exact: true }).click();
  await cropper.getByRole('img', { name: /Logo position/ }).press('ArrowRight');
  await cropper.getByRole('button', { name: 'Use logo', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Company logo preview' })).toBeVisible();
  await page.getByRole('button', { name: 'Send verification link' }).click();
  await expect(page.getByRole('alert')).toHaveText('This signup code is invalid, expired, or already used.');
  await page.getByLabel('Signup code', { exact: true }).fill(signupCode());
  await page.getByRole('button', { name: 'Send verification link' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await page.goto(await emailLink(founder, '/verify-email'));
  await page.getByLabel('New password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/company-setup/);
  await expect(page.getByRole('img', { name: 'Company logo preview' })).toBeVisible();
  await page.getByRole('radio', { name: 'Someone else owns it' }).check();
  await page.getByLabel('Owner’s name', { exact: true }).fill('Company Boss');
  await page.getByLabel('Owner’s email', { exact: true }).fill(boss);
  await page.getByRole('button', { name: 'Create company', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Queue', exact: true })).toBeVisible();
  const logo = page.locator('.wordmark img.company-logo');
  await expect(logo).toBeVisible();
  expect(await logo.evaluate((image: HTMLImageElement) => [image.naturalWidth, image.naturalHeight])).toEqual([
    224, 224,
  ]);

  const bossContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const bossPage = await bossContext.newPage();
  await bossPage.goto(await emailLink(boss, '/invite/'));
  await expect(bossPage.getByRole('heading', { name: 'Take ownership' })).toBeVisible();
  await expect(bossPage.getByText('Owner · Company admin', { exact: true })).toBeVisible();
  await bossPage.getByRole('link', { name: 'Create an account', exact: true }).click();
  await signup(bossPage, boss, 'Company Boss');
  await bossPage.getByRole('button', { name: 'Accept invitation' }).click();
  await bossPage.getByRole('button', { name: 'Open workspace', exact: true }).click();
  await bossPage.getByRole('link', { name: 'People', exact: true }).click();
  const founderRow = bossPage.getByRole('row').filter({ hasText: 'Office Manager' });
  await expect(bossPage.getByRole('row').filter({ hasText: 'Company Boss' })).toContainText('Owner, Company admin');
  await founderRow.getByRole('button', { name: 'Open Office Manager' }).click();
  const drawer = bossPage.getByRole('dialog', { name: 'Person details for Office Manager' });
  await drawer.getByRole('button', { name: 'Make Office Manager the owner' }).click();
  await drawer.getByRole('button', { name: 'Make owner', exact: true }).click();
  await expect(drawer.getByRole('button', { name: 'Make owner', exact: true })).toHaveCount(0);
  await expect(founderRow).toContainText('Owner, Company admin');
  await bossContext.close();
});

test('a new company builds its inventory through public screens and a worker receives a tool', async ({
  page,
  browser,
}) => {
  const { base } = await ownedCompany(page);
  const workerContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 390, height: 844 },
  });
  const worker = await workerContext.newPage();
  await invitedMember(page, worker, base, 'field_member', 'Field Employee');
  await page.goto('/app/warehouses');
  await page.getByRole('button', { name: 'Add warehouse', exact: true }).click();
  const warehouseDialog = page.getByRole('dialog', { name: 'Create warehouse', exact: true });
  await warehouseDialog.getByLabel('Code', { exact: true }).fill('MAIN');
  await warehouseDialog.getByLabel('Name', { exact: true }).fill('Main warehouse');
  await warehouseDialog.getByRole('button', { name: 'Save warehouse', exact: true }).click();
  await expect(warehouseDialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open Main warehouse', exact: true })).toBeVisible();
  await page.goto('/app/catalog');
  await page.getByRole('tab', { name: 'Categories', exact: true }).click();
  await page.getByRole('button', { name: 'Add category', exact: true }).click();
  const categoryDialog = page.getByRole('dialog', { name: 'Add category', exact: true });
  await categoryDialog.getByLabel('Category name', { exact: true }).fill('Drills');
  await categoryDialog.getByRole('button', { name: 'Add category', exact: true }).click();
  await expect(categoryDialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit Drills', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Models', exact: true }).click();
  await page.getByRole('button', { name: 'Add model', exact: true }).click();
  const modelDialog = page.getByRole('dialog', { name: 'Create model', exact: true });
  await chooseOption(modelDialog, 'Category', { label: 'Drills' });
  await modelDialog.getByLabel('Tool name').fill('Hammer drill');
  await modelDialog.getByLabel('Manufacturer').fill('Makita');
  await modelDialog.getByLabel('Model number').fill('XPH14');
  await modelDialog.getByRole('button', { name: 'Save model', exact: true }).click();
  await expect(modelDialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit Hammer drill', exact: true })).toBeVisible();
  await page.goto('/app/tools/new');
  await page.getByRole('button', { name: 'Continue without a photo' }).click();
  await chooseOption(page, 'Tool model', { label: 'Makita Hammer drill' });
  await chooseOption(page, 'Home warehouse', { label: 'Main warehouse' });
  await page.getByLabel('Asset tag', { exact: true }).fill('TEST-001');
  await page.getByRole('button', { name: 'Add tool', exact: true }).click();
  // The wizard closes onto the new tool's record.
  await expect(page.getByRole('dialog', { name: 'Hammer drill details', exact: true })).toBeVisible();
  const toolId = new URL(page.url()).pathname.split('/').pop();
  await worker.goto(`/app/checkout/${toolId}?action=request`);
  await worker.getByRole('button', { name: 'Request from Main warehouse', exact: true }).click();
  // The action panel closes once the request is recorded.
  await expect(worker.getByRole('form', { name: 'Action details', exact: true })).toHaveCount(0);
  await worker.goto(`/app/checkout/${toolId}?action=request`);
  await expect(worker.getByText('You already requested this tool. It is waiting for review.')).toBeVisible();
  await page.goto('/app/operations');
  await page.getByRole('button', { name: 'Review request for Hammer drill', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Review Hammer drill', exact: true })
    .getByRole('button', { name: 'Release to worker', exact: true })
    .click();
  await expect(page.getByRole('dialog', { name: 'Review Hammer drill', exact: true })).toHaveCount(0);
  await expect(page.getByText('Released · awaiting pickup', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Release for Hammer drill', exact: true })).toHaveCount(0);
  // The released tool waits in the worker's own pending list until they accept custody.
  await worker.goto('/app/mine');
  await worker
    .getByRole('article', { name: 'Hammer drill pending handoff', exact: true })
    .getByRole('button', { name: 'Review and accept', exact: true })
    .click();
  const receipt = worker.getByRole('dialog', { name: 'Hammer drill transfer review', exact: true });
  await receipt.getByRole('checkbox', { name: 'I have inspected this tool', exact: true }).click();
  await receipt.getByRole('button', { name: 'Accept — take custody', exact: true }).click();
  await expect(receipt).toHaveCount(0);
  await expect(worker.getByRole('article', { name: 'Hammer drill pending handoff', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Review request for Hammer drill', exact: true })).toHaveCount(0);
  await page.goto(`/app/tools/${toolId}`);
  await expect(
    page.getByRole('region', { name: 'Current custody', exact: true }).getByText('Field Employee', { exact: true }),
  ).toBeVisible();
  await expect(
    worker.getByRole('button', { name: 'Open details for Hammer drill unit TEST-001', exact: true }),
  ).toBeVisible();
  await worker.screenshot({ path: 'artifacts/real-app-mobile.png', fullPage: true });
  await workerContext.close();
});

test('a member recovers their password, signs in with it and signs out', async ({ page, browser }) => {
  const { base } = await ownedCompany(page);
  const workerContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 390, height: 844 },
  });
  const worker = await workerContext.newPage();
  const { email: employee } = await invitedMember(page, worker, base, 'field_member', 'Field Employee');
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
  const credentials = await worker.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
  expect(JSON.stringify(credentials)).not.toContain(password);
  await worker.getByRole('button', { name: 'Menu', exact: true }).click();
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
  await page.goto('/signup?as=company');
  await page.getByLabel('Signup code', { exact: true }).fill(signupCode());
  await page.getByLabel('Your name', { exact: true }).fill('Account Test');
  await page.getByLabel('Work email', { exact: true }).fill(email);
  await page.getByLabel('Company name', { exact: true }).fill('Account Test Company');
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
