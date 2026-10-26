import { test, expect } from '@playwright/test';
import { chooseDestination, command, invitedMember, workspace } from './support';

for (const role of ['company_admin', 'equipment_manager', 'warehouse'])
  test(`${role} cancels a stranded proposal while retaining the ended holder's identity`, async ({ page, browser }) => {
    const fixture = await workspace(page);
    const holderContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
    const receiverContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
    const managerContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
    const holder = await holderContext.newPage();
    const receiver = await receiverContext.newPage();
    const manager = role === 'company_admin' ? page : await managerContext.newPage();
    try {
      const holderMember = await invitedMember(page, holder, fixture.base, 'field_member', 'Departed operator');
      const recipient = await invitedMember(page, receiver, fixture.base, 'field_member', 'Unavailable recipient');
      if (manager !== page) {
        const actor = await invitedMember(
          page,
          manager,
          fixture.base,
          role === 'warehouse' ? 'field_member' : role,
          'Recovery reviewer',
        );
        if (role === 'warehouse')
          await command(page.request, `${fixture.base}/warehouses/${fixture.warehouse.id}/authority`, {
            expected_revision: 1,
            membership_id: actor.id,
            enabled: true,
          });
      }
      const issued = await command(page.request, `${fixture.base}/tools/${fixture.asset.id}/handoffs`, {
        request_key: crypto.randomUUID(),
        expected_revision: fixture.asset.revision,
        destination_membership_id: holderMember.id,
      });
      await command(holder.request, `${fixture.base}/handoffs/${issued.id}/accept`, {
        expected_revision: issued.revision,
      });
      await holder.goto(`/app/mine/${fixture.asset.id}?action=transfer`);
      await chooseDestination(holder, 'Person', 'Unavailable recipient');
      await holder.getByRole('button', { name: 'Propose handoff' }).click();
      await expect(holder.getByText(/This tool has a pending handoff/)).toBeVisible();
      const before = (await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json()).items;
      await command(page.request, `${fixture.base}/people/${holderMember.id}/update`, {
        expected_revision: 1,
        access_state: 'disabled',
        roles: ['field_member'],
        end_membership: true,
        reason: 'Employment ended with accountability outstanding',
      });
      await command(page.request, `${fixture.base}/people/${recipient.id}/update`, {
        expected_revision: 1,
        access_state: 'suspended',
        roles: ['field_member'],
        reason: 'Recipient unavailable',
      });
      await manager.goto('/app/operations');
      await manager
        .getByRole('region', { name: 'Handoffs', exact: true })
        .getByRole('button', { name: 'Review handoff' })
        .click();
      const review = manager.getByRole('dialog', { name: 'Review handoff', exact: true });
      await review.getByLabel('Decision').selectOption('void');
      await expect(review.getByLabel('Note', { exact: true })).toHaveAttribute('required', '');
      await review
        .getByLabel('Note', { exact: true })
        .fill('Cancelled stale proposal; physical custody has not changed');
      await review.getByRole('button', { name: 'Confirm handoff decision' }).click();
      await expect(review).toHaveCount(0);
      expect(
        (await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json()).items,
      ).toEqual(before);
      await manager.goto(`/app/tools/${fixture.asset.id}`);
      const custody = manager.getByRole('region', { name: 'Current custody', exact: true });
      await expect(custody.getByText('Departed operator', { exact: true })).toBeVisible();
      await expect(custody.getByText(/Former employee/)).toBeVisible();
      await expect(manager.getByRole('button', { name: 'Transfer tool', exact: true })).toHaveCount(0);
      if (role === 'warehouse') {
        await expect(manager.getByRole('button', { name: 'Open a reconciliation case', exact: true })).toHaveCount(0);
        return;
      }
      await manager.getByRole('button', { name: 'Open a reconciliation case', exact: true }).click();
      await manager
        .getByLabel('Describe the discrepancy')
        .fill('Warehouse inventory confirms the ended employee returned this tool');
      await manager.getByRole('button', { name: 'Open case', exact: true }).click();
      await expect(
        manager.getByRole('region', { name: 'Open a reconciliation case', exact: true }).getByRole('status'),
      ).toBeVisible();
      await manager.getByRole('link', { name: 'View open cases', exact: true }).click();
      await manager.getByLabel('Findings and resolution').fill('Physical return verified with warehouse photo');
      await manager
        .getByLabel('Correct custody (photo required if changed)')
        .selectOption(`warehouse:${fixture.warehouse.id}`);
      await manager.getByRole('button', { name: 'Resolve case', exact: true }).click();
      await expect(manager.getByRole('alert')).toContainText('photo evidence');
      await expect(manager.getByRole('button', { name: 'Load latest values', exact: true })).toHaveCount(0);
      expect(
        (await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json()).items,
      ).toEqual(before);
      await manager.getByLabel('Photo (optional, up to 8 MB)').setInputFiles('e2e/fixtures/hammer-drill.jpg');
      await manager.getByRole('button', { name: 'Resolve case', exact: true }).click();
      await expect(manager.getByText('No open cases.')).toBeVisible();
      const history = (await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}/custody`)).json())
        .items;
      expect(history).toHaveLength(3);
      expect(history[0]).toMatchObject({ holder_warehouse_id: fixture.warehouse.id, ends_at: null });
      expect(history[1]).toMatchObject({ holder_membership_id: holderMember.id, holder_name: 'Departed operator' });
      expect(history[1].ends_at).not.toBeNull();
    } finally {
      await holderContext.close();
      await receiverContext.close();
      await managerContext.close();
    }
  });

test('a source warehouse grant does not authorize another warehouse receipt', async ({ page, browser }) => {
  const fixture = await workspace(page);
  const holderContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const managerContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const holder = await holderContext.newPage();
  const manager = await managerContext.newPage();
  try {
    const operator = await invitedMember(page, holder, fixture.base, 'field_member', 'Returning operator');
    const reviewer = await invitedMember(page, manager, fixture.base, 'field_member', 'Warehouse reviewer');
    await command(page.request, `${fixture.base}/warehouses/${fixture.warehouse.id}/authority`, {
      expected_revision: 1,
      membership_id: reviewer.id,
      enabled: true,
    });
    const east = await command(page.request, `${fixture.base}/warehouses`, { code: 'EAST', name: 'East warehouse' });
    const issued = await command(page.request, `${fixture.base}/tools/${fixture.asset.id}/handoffs`, {
      request_key: crypto.randomUUID(),
      expected_revision: fixture.asset.revision,
      destination_membership_id: operator.id,
    });
    await command(holder.request, `${fixture.base}/handoffs/${issued.id}/accept`, {
      expected_revision: issued.revision,
    });
    await holder.setViewportSize({ width: 390, height: 844 });
    await holder.goto(`/app/mine/${fixture.asset.id}?action=transfer`);
    await chooseDestination(holder, 'Warehouse', 'East warehouse');
    await holder.screenshot({ path: 'artifacts/parity-return-destination-mobile.png', fullPage: true });
    await holder.getByRole('button', { name: 'Propose handoff' }).click();
    await expect(holder.getByText(/This tool has a pending handoff/)).toBeVisible();
    const handoff = (await (await page.request.get(`${fixture.base}/handoffs`)).json()).items[0];
    await manager.goto('/app/operations');
    await manager
      .getByRole('region', { name: 'Handoffs', exact: true })
      .getByRole('button', { name: 'Review handoff' })
      .click();
    await expect(manager.getByLabel('Decision').getByRole('option', { name: /Accept/ })).toHaveCount(0);
    const csrf = await (await manager.request.get('/api/auth/csrf')).json();
    const denied = await manager.request.post(`${fixture.base}/handoffs/${handoff.id}/accept`, {
      data: { expected_revision: handoff.revision },
      headers: { 'X-CSRFToken': csrf.csrf_token },
    });
    expect(denied.status()).toBe(403);
    await page.goto('/app/warehouses');
    await page.getByRole('button', { name: 'East warehouse', exact: true }).click();
    const authority = page.getByRole('region', { name: 'Management authority', exact: true });
    await authority.getByLabel('Person').selectOption(reviewer.id);
    await authority.getByRole('button', { name: 'Grant warehouse authority' }).click();
    await expect(authority.getByRole('button', { name: "Revoke Warehouse reviewer's warehouse access" })).toBeVisible();
    await manager.reload();
    await expect(manager.getByRole('dialog', { name: 'Review handoff', exact: true })).toBeVisible();
    await manager.getByLabel('Decision').selectOption('accept');
    await manager.getByRole('button', { name: 'Confirm handoff decision' }).click();
    await expect(manager.getByText('No handoffs to review.')).toBeVisible();
    expect(await (await page.request.get(`${fixture.base}/tools/${fixture.asset.id}`)).json()).toMatchObject({
      warehouse_id: east.id,
      responsible_warehouse_id: east.id,
      origin_warehouse_id: fixture.warehouse.id,
      holder_membership_id: null,
    });
  } finally {
    await holderContext.close();
    await managerContext.close();
  }
});
