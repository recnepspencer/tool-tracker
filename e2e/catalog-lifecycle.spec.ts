import { expect } from '@playwright/test';
import { command, invitedMember, workspace, chooseOption, test } from './support';

for (const role of ['company_admin', 'equipment_manager'])
  test(`${role} edits and archives catalog records without changing physical custody`, async ({ page, browser }) => {
    const fixture = await workspace(page);
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
    const actor = role === 'company_admin' ? page : await context.newPage();
    try {
      if (actor !== page) await invitedMember(page, actor, fixture.base, role, 'Equipment reviewer');
      const before = (await (await page.request.get(`${fixture.base}/tools`)).json()).items;
      await actor.goto('/app/catalog');
      const modelStatus = actor.getByRole('tablist', { name: 'Tool type status', exact: true });
      const modelDialog = actor.getByRole('dialog', { name: 'Edit tool type', exact: true });
      await expect(actor.getByRole('button', { name: 'Edit Hammer drill', exact: true })).toHaveCount(1);
      await actor.getByRole('button', { name: 'Edit Hammer drill', exact: true }).click();
      await modelDialog.getByLabel('Tool name', { exact: true }).fill('Combi drill');
      await modelDialog.getByLabel('Model number').fill('C100');
      await modelDialog.getByRole('button', { name: 'Save tool type', exact: true }).click();
      await expect(modelDialog).toHaveCount(0);
      await expect(actor.getByRole('button', { name: 'Edit Combi drill', exact: true })).toBeVisible();
      const after = (await (await page.request.get(`${fixture.base}/tools`)).json()).items;
      expect(
        after.map(
          (asset: {
            id: string;
            tool_model_id: string;
            holder_membership_id: string | null;
            warehouse_id: string | null;
          }) => [asset.id, asset.tool_model_id, asset.holder_membership_id, asset.warehouse_id],
        ),
      ).toEqual(
        before.map(
          (asset: {
            id: string;
            tool_model_id: string;
            holder_membership_id: string | null;
            warehouse_id: string | null;
          }) => [asset.id, asset.tool_model_id, asset.holder_membership_id, asset.warehouse_id],
        ),
      );
      expect(after.map((asset: { name: string }) => asset.name)).toEqual(['Combi drill', 'Combi drill']);
      await actor.getByRole('button', { name: 'Edit Combi drill', exact: true }).click();
      await modelDialog.getByRole('button', { name: 'Archive tool type', exact: true }).click();
      await expect(modelDialog).toHaveCount(0);
      await expect(actor.getByRole('button', { name: 'Edit Combi drill', exact: true })).toHaveCount(0);
      await modelStatus.getByRole('tab', { name: 'Archived', exact: true }).click();
      await expect(modelStatus.getByRole('tab', { name: 'Archived', exact: true })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(actor.getByRole('button', { name: 'Edit Combi drill', exact: true })).toHaveCount(1);
      await actor.getByRole('button', { name: 'Edit Combi drill', exact: true }).click();
      await expect(modelDialog.getByRole('combobox', { name: 'Category', exact: true })).toHaveText('Drills');
      await expect(modelDialog.locator('input.field-select-proxy[name="category"]')).toHaveValue(
        fixture.asset.category_id,
      );
      await modelDialog.getByRole('button', { name: 'Restore tool type', exact: true }).click();
      await expect(modelDialog).toHaveCount(0);
      await expect(actor.getByRole('button', { name: 'Edit Combi drill', exact: true })).toHaveCount(0);
      await modelStatus.getByRole('tab', { name: 'Active', exact: true }).click();
      await expect(modelStatus.getByRole('tab', { name: 'Active', exact: true })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(actor.getByRole('button', { name: 'Edit Combi drill', exact: true })).toHaveCount(1);
      const categories = actor.getByRole('region', { name: 'Tool categories', exact: true });
      await expect(categories.locator('.category-row')).toHaveCount(1);
      await categories.getByRole('button', { name: 'Rename Drills', exact: true }).click();
      await categories.getByRole('textbox', { name: 'Rename Drills', exact: true }).fill('Historical drills');
      await categories.getByRole('button', { name: 'Save', exact: true }).click();
      await categories.getByRole('button', { name: 'Archive Historical drills', exact: true }).click();
      await expect(categories.getByText('Historical drills', { exact: true })).toHaveCount(0);
      await actor.goto('/app/tools/new');
      await actor.getByRole('button', { name: 'Continue without a photo' }).click();
      // Models in an archived category are not offered for registration.
      await actor.getByRole('combobox', { name: 'Tool type', exact: true }).click();
      await expect(actor.getByRole('listbox', { name: 'Tool type', exact: true }).getByRole('option')).toHaveCount(0);
      await actor.keyboard.press('Escape');
      await expect(actor.getByText(/No tool types are currently eligible/)).toBeVisible();
      await actor.goto('/app/catalog?categories=archived');
      await categories.getByRole('button', { name: 'Restore Historical drills', exact: true }).click();
      await expect(categories.getByText('Historical drills', { exact: true })).toHaveCount(0);
      await actor.goto('/app/tools/new');
      await actor.getByRole('button', { name: 'Continue without a photo' }).click();
      await chooseOption(actor, 'Tool type', fixture.asset.tool_model_id);
      await chooseOption(actor, 'Home warehouse', fixture.warehouse.id);
      await actor.getByLabel('Asset tag', { exact: true }).fill('CATALOG-003');
      await actor.getByRole('button', { name: 'Add tool', exact: true }).click();
      await expect(actor.getByRole('dialog', { name: 'Combi drill details', exact: true })).toBeVisible();
      const created = (await (await actor.request.get(`${fixture.base}/tools?search=CATALOG-003`)).json()).items;
      expect(created).toHaveLength(1);
      expect(created[0]).toMatchObject({
        tool_model_id: fixture.asset.tool_model_id,
        warehouse_id: fixture.warehouse.id,
        holder_membership_id: null,
      });
    } finally {
      await context.close();
    }
  });

test('warehouse grants show their subjects and remain revocable after employment ends', async ({ page, browser }) => {
  const fixture = await workspace(page);
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const worker = await context.newPage();
  const estimatorPage = await context.newPage();
  try {
    const member = await invitedMember(page, worker, fixture.base, 'field_member', 'Warehouse lead');
    // A separate cookie context is unnecessary here: the subject is not logged into the owner page.
    const estimator = await invitedMember(page, estimatorPage, fixture.base, 'estimator', 'Estimator only');
    await page.goto('/app/warehouses');
    await page.getByRole('button', { name: 'Main warehouse', exact: true }).click();
    const authority = page
      .getByRole('dialog', { name: 'Edit warehouse', exact: true })
      .getByRole('group', { name: 'Managers', exact: true });
    await authority.getByRole('combobox', { name: 'Manager', exact: true }).click();
    const candidates = page.getByRole('listbox', { name: 'Manager', exact: true });
    await expect(candidates.getByRole('option', { name: 'Warehouse lead' })).toBeVisible();
    await expect(candidates.getByRole('option', { name: 'Estimator only' })).toHaveCount(0);
    await candidates.locator(`[data-value="${member.id}"]`).click();
    await authority.getByRole('button', { name: 'Add manager', exact: true }).click();
    await expect(authority.getByRole('button', { name: 'Remove Warehouse lead', exact: true })).toBeVisible();
    await command(page.request, `${fixture.base}/people/${member.id}/update`, {
      expected_revision: member.revision,
      access_state: 'disabled',
      roles: ['field_member'],
      end_membership: true,
      reason: 'Employment ended',
    });
    await page.reload();
    await expect(authority.getByText('Grant retained; equipment access is currently inactive.')).toBeVisible();
    await authority.getByRole('button', { name: 'Remove Warehouse lead', exact: true }).click();
    await expect(authority.getByText(/No warehouse managers yet/)).toBeVisible();
    const warehouses = (await (await page.request.get(`${fixture.base}/warehouses`)).json()).items;
    expect(warehouses[0].managers).toEqual([]);
    expect(
      (await (await page.request.get(`${fixture.base}/people`)).json()).items.some(
        (person: { id: string }) => person.id === estimator.id,
      ),
    ).toBe(true);
  } finally {
    await context.close();
  }
});
