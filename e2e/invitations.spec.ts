import { test, expect } from '@playwright/test';
import { command, emailLink, password, workspace } from './support';

test('revoked links recover clearly and a replacement invitation joins the intended workspace', async ({
  page,
  browser,
}) => {
  const fixture = await workspace(page);
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173', viewport: { width: 390, height: 844 } });
  const teammate = await context.newPage();
  const email = `invitation-${crypto.randomUUID().slice(0, 10)}@example.com`;
  try {
    await command(teammate.request, '/api/auth/signup', { email, name: 'New teammate' });
    const verification = new URL(await emailLink(email, '/verify-email'), 'http://localhost');
    await command(teammate.request, '/api/auth/verify-signup', {
      token: verification.searchParams.get('token'),
      password,
    });
    await page.goto('/app/people');
    const send = async () => {
      await page.getByRole('button', { name: 'Invite person', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Invite a teammate', exact: true });
      await dialog.getByLabel('Name', { exact: true }).fill('New teammate');
      await dialog.getByLabel('Email address', { exact: true }).fill(email);
      await dialog.getByRole('button', { name: 'Send invitation', exact: true }).click();
      const link = dialog.getByRole('link');
      await expect(link).toBeVisible();
      const url = await link.getAttribute('href');
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      return url!;
    };
    const first = await send();
    const invitations = page.getByRole('region', { name: 'Invitations', exact: true });
    const firstRow = invitations.getByRole('article').filter({ hasText: email });
    await firstRow.getByRole('button', { name: 'Revoke invitation', exact: true }).click();
    await expect(firstRow.getByText('Revoked', { exact: true })).toBeVisible();
    await teammate.goto(first);
    await expect(teammate.getByRole('heading', { name: 'Invitation unavailable', exact: true })).toBeVisible();

    // Revoke through the actual API without moving browser focus, so the
    // already-loaded preview remains stale until the person submits it.
    const stale = await command(page.request, `${fixture.base}/invitations`, {
      email,
      preferred_name: 'New teammate',
      role: 'field_member',
    });
    await teammate.goto(`/invite/${stale.token}`);
    await expect(teammate.getByRole('button', { name: 'Accept invitation', exact: true })).toBeVisible();
    await command(page.request, `${fixture.base}/invitations/${stale.invitation.id}/revoke`, {});
    await teammate.getByRole('button', { name: 'Accept invitation', exact: true }).click();
    await expect(teammate.getByRole('heading', { name: 'Invitation unavailable', exact: true })).toBeVisible();
    await expect(teammate.getByRole('button', { name: 'Accept invitation', exact: true })).toHaveCount(0);
    expect((await (await teammate.request.get('/api/me')).json()).memberships).toEqual([]);
    await teammate.screenshot({ path: 'artifacts/invitation-revoked-mobile.png', fullPage: true });

    await page.reload();
    const replacement = await send();
    expect(replacement).not.toBe(first);
    await teammate.goto(replacement);
    await teammate.getByRole('button', { name: 'Accept invitation', exact: true }).click();
    await expect(teammate.getByRole('heading', { name: 'Invitation accepted', exact: true })).toBeVisible();
    await teammate.getByRole('button', { name: 'Open workspace', exact: true }).click();
    await expect(teammate.getByRole('heading', { name: 'My tools', exact: true })).toBeVisible();
    const membership = (await (await teammate.request.get('/api/me')).json()).memberships;
    expect(membership).toHaveLength(1);
    expect(membership[0].company_id).toBe(fixture.company.id);
    expect(membership[0].capabilities).toContain('tools.request');
    expect(membership[0].capabilities).not.toContain('people.manage');
    await page.reload();
    await expect(invitations.getByText('Accepted', { exact: true })).toHaveCount(1);
    await expect(invitations.getByText('Revoked', { exact: true })).toHaveCount(2);
    await teammate.goto(replacement);
    await expect(teammate.getByRole('heading', { name: 'Invitation unavailable', exact: true })).toBeVisible();
    await teammate.getByRole('link', { name: 'Back to your workspace', exact: true }).click();
    await expect(teammate.getByRole('heading', { name: 'My tools', exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});
