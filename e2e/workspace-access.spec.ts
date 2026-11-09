import { expect } from '@playwright/test';
import { command, invitedMember, workspace, chooseOption, signupCode, test } from './support';

test('workspace changes leave old details behind and a revoked workspace does not sign out another membership', async ({
  page,
  browser,
}) => {
  const fixture = await workspace(page);
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const actor = await context.newPage();
  try {
    const member = await invitedMember(page, actor, fixture.base, 'field_member', 'Cross-company employee');
    const identity = (await (await actor.request.get('/api/me')).json()).user_id;
    await actor.goto(`/app/checkout/${fixture.asset.id}`);
    const second = await command(actor.request, '/api/companies', {
      request_key: crypto.randomUUID(),
      name: 'Recovery workspace',
      preferred_name: 'Cross-company employee',
      signup_code: signupCode(),
    });
    const toolSheet = actor.getByRole('dialog', { name: 'Tool details', exact: true });
    await expect(toolSheet).toBeVisible();
    await actor.keyboard.press('Escape');
    await expect(toolSheet).toHaveCount(0);
    await actor.getByRole('button', { name: 'Menu', exact: true }).click();
    const sheet = actor.getByRole('dialog', { name: 'Menu', exact: true });
    await sheet.getByRole('button', { name: 'Refresh access', exact: true }).click();
    await sheet.getByRole('combobox', { name: 'Workspace', exact: true }).click();
    await expect(
      actor
        .getByRole('listbox', { name: 'Workspace', exact: true })
        .getByRole('option', { name: 'Recovery workspace', exact: true }),
    ).toBeVisible();
    // The workspace sheet opens over the Menu; choose it by keyboard as a screen reader would.
    const recovery = actor
      .getByRole('listbox', { name: 'Workspace', exact: true })
      .locator(`[data-value="${second.id}"]`);
    await recovery.focus();
    await recovery.press('Enter');
    await expect(actor).toHaveURL(/\/app\/operations$/);
    await expect(actor.getByRole('heading', { name: 'Queue', exact: true })).toBeVisible();
    await expect(actor.getByRole('dialog', { name: 'Tool details', exact: true })).toHaveCount(0);
    await actor.getByRole('button', { name: 'Open account menu', exact: true }).click();
    await chooseOption(
      actor.getByRole('dialog', { name: 'Cross-company employee', exact: true }),
      'Workspace',
      fixture.company.id,
    );
    await expect(actor).toHaveURL(/\/app\/mine$/);
    await actor.goto(`/app/checkout/${fixture.asset.id}?action=request`);
    await expect(actor.getByRole('button', { name: 'Request from Main warehouse', exact: true })).toBeVisible();
    await command(page.request, `${fixture.base}/people/${member.id}/update`, {
      expected_revision: 1,
      access_state: 'suspended',
      roles: ['field_member'],
      reason: 'Suspend only this company membership',
    });
    await actor.getByRole('button', { name: 'Request from Main warehouse', exact: true }).click();
    await expect(actor).toHaveURL(/company-setup/);
    await expect(actor.getByRole('heading', { name: 'Sign in', exact: true })).toHaveCount(0);
    await actor.getByRole('button', { name: 'Open Recovery workspace', exact: true }).click();
    await expect(actor.getByRole('heading', { name: 'Queue', exact: true })).toBeVisible();
    const session = await (await actor.request.get('/api/me')).json();
    expect(session.user_id).toBe(identity);
    expect(session.memberships.map((item: { company_id: string }) => item.company_id)).toEqual([second.id]);
    expect((await (await page.request.get(`${fixture.base}/tool-requests`)).json()).items).toEqual([]);
    expect((await actor.request.get(`${fixture.base}/tools`)).status()).toBe(403);
    await actor.getByRole('link', { name: 'Inventory', exact: true }).click();
    await expect(actor.getByText('No tools match this inventory view.')).toBeVisible();
  } finally {
    await context.close();
  }
});
