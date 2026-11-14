import { expect } from '@playwright/test';
import { command, invitedMember, workspace, chooseOption, test } from './support';

for (const role of ['admin', 'manager'])
  test(`${role} edits and archives catalog records without changing physical custody`, async ({ page, browser }) => {
    const fixture = await workspace(page);
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
    const actor = role === 'admin' ? page : await context.newPage();
    try {
      if (actor !== page) await invitedMember(page, actor, fixture.base, role, 'Equipment reviewer');
      const before = (await (await page.request.get(`${fixture.base}/tools`)).json()).items;
      await actor.goto('/app/catalog');
      const showArchived = actor.getByRole('button', { name: 'Show archived models', exact: true });
      const showActive = actor.getByRole('button', { name: 'Show active models', exact: true });
      const undo = actor.getByRole('status').getByRole('button', { name: 'Undo', exact: true });
      const modelDialog = actor.getByRole('dialog', { name: 'Edit model', exact: true });
      await expect(actor.getByRole('button', { name: 'Edit Hammer drill', exact: true })).toHaveCount(1);
      await actor.getByRole('button', { name: 'Edit Hammer drill', exact: true }).click();
      await modelDialog.getByLabel('Tool name', { exact: true }).fill('Combi drill');
      await modelDialog.getByLabel('Model number').fill('C100');
      await modelDialog.getByRole('button', { name: 'Save model', exact: true }).click();
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
      // Archiving happens at once and can be taken back from the message that follows.
      await modelDialog.getByRole('button', { name: 'Archive model', exact: true }).click();
      await expect(modelDialog).toHaveCount(0);
      await expect(actor.getByRole('button', { name: 'Edit Combi drill', exact: true })).toHaveCount(0);
      await expect(actor.getByRole('status').getByText('Combi drill archived.')).toBeVisible();
      await undo.click();
      await expect(actor.getByRole('button', { name: 'Edit Combi drill', exact: true })).toHaveCount(1);
      await expect(undo).toHaveCount(0);
      await actor.getByRole('button', { name: 'Edit Combi drill', exact: true }).click();
      await modelDialog.getByRole('button', { name: 'Archive model', exact: true }).click();
      await expect(actor.getByRole('button', { name: 'Edit Combi drill', exact: true })).toHaveCount(0);
      await showArchived.click();
      await expect(actor).toHaveURL(/archived=true/);
      await expect(actor.getByRole('button', { name: 'Edit Combi drill', exact: true })).toHaveCount(1);
      await actor.getByRole('button', { name: 'Edit Combi drill', exact: true }).click();
      await expect(modelDialog.getByRole('combobox', { name: 'Category', exact: true })).toHaveText('Drills');
      await expect(modelDialog.locator('input.field-select-proxy[name="category"]')).toHaveValue(
        fixture.asset.category_id,
      );
      await modelDialog.getByRole('button', { name: 'Restore model', exact: true }).click();
      await expect(modelDialog).toHaveCount(0);
      await expect(actor.getByRole('button', { name: 'Edit Combi drill', exact: true })).toHaveCount(0);
      await showActive.click();
      await expect(showArchived).toBeVisible();
      await expect(actor.getByRole('button', { name: 'Edit Combi drill', exact: true })).toHaveCount(1);
      await actor.getByRole('tab', { name: 'Categories', exact: true }).click();
      await expect(actor).toHaveURL(/view=categories/);
      await actor.getByRole('button', { name: 'Edit Drills', exact: true }).click();
      const categoryDialog = actor.getByRole('dialog', { name: 'Drills', exact: true });
      await categoryDialog.getByLabel('Category name', { exact: true }).fill('Historical drills');
      await categoryDialog.getByRole('button', { name: 'Save category', exact: true }).click();
      await expect(categoryDialog).toHaveCount(0);
      await actor.getByRole('button', { name: 'Edit Historical drills', exact: true }).click();
      await actor
        .getByRole('dialog', { name: 'Historical drills', exact: true })
        .getByRole('button', { name: 'Archive category', exact: true })
        .click();
      await expect(actor.getByRole('button', { name: 'Edit Historical drills', exact: true })).toHaveCount(0);
      await actor.goto('/app/tools/new');
      // Models in an archived category are not offered for registration.
      await actor.getByRole('combobox', { name: 'Tool model', exact: true }).click();
      await expect(actor.getByRole('listbox', { name: 'Tool model', exact: true }).getByRole('option')).toHaveCount(0);
      await actor.keyboard.press('Escape');
      await expect(actor.getByText(/No models are currently eligible/)).toBeVisible();
      await actor.goto('/app/catalog?view=categories&archived=true');
      await actor.getByRole('button', { name: 'Edit Historical drills', exact: true }).click();
      await actor
        .getByRole('dialog', { name: 'Historical drills', exact: true })
        .getByRole('button', { name: 'Restore category', exact: true })
        .click();
      await expect(actor.getByRole('button', { name: 'Edit Historical drills', exact: true })).toHaveCount(0);
      await actor.goto('/app/tools/new');
      await chooseOption(actor, 'Tool model', fixture.asset.tool_model_id);
      await chooseOption(actor, 'Home warehouse', fixture.warehouse.id);
      await actor.getByRole('button', { name: 'Add tool', exact: true }).click();
      await expect(actor.getByRole('dialog', { name: 'Combi drill details', exact: true })).toBeVisible();
      // The form closes onto the new tool's record.
      const createdId = new URL(actor.url()).pathname.split('/').pop();
      const created = await (await actor.request.get(`${fixture.base}/tools/${createdId}`)).json();
      expect(created).toMatchObject({
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
  try {
    // Every role carries tools, so any foreman can be named to manage a warehouse.
    const member = await invitedMember(page, worker, fixture.base, 'foreman', 'Warehouse lead');
    await page.goto('/app/warehouses');
    await page.getByRole('button', { name: 'Open Main warehouse', exact: true }).click();
    const authority = page
      .getByRole('dialog', { name: 'Edit warehouse', exact: true })
      .getByRole('group', { name: 'Managers', exact: true });
    await authority.getByRole('combobox', { name: 'Manager', exact: true }).click();
    const candidates = page.getByRole('listbox', { name: 'Manager', exact: true });
    await expect(candidates.getByRole('option', { name: 'Warehouse lead' })).toBeVisible();
    await candidates.locator(`[data-value="${member.id}"]`).click();
    await authority.getByRole('button', { name: 'Add manager', exact: true }).click();
    await expect(authority.getByRole('button', { name: 'Remove Warehouse lead', exact: true })).toBeVisible();
    await command(page.request, `${fixture.base}/people/${member.id}/update`, {
      expected_revision: member.revision,
      access_state: 'disabled',
      role: 'foreman',
      end_membership: true,
      reason: 'Employment ended',
    });
    await page.reload();
    await expect(authority.getByText('Grant retained; equipment access is currently inactive.')).toBeVisible();
    await authority.getByRole('button', { name: 'Remove Warehouse lead', exact: true }).click();
    await expect(authority.getByText(/No warehouse managers yet/)).toBeVisible();
    const warehouses = (await (await page.request.get(`${fixture.base}/warehouses`)).json()).items;
    expect(warehouses[0].managers).toEqual([]);
  } finally {
    await context.close();
  }
});
