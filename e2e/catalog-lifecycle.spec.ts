import { test, expect } from '@playwright/test';
import { command, invitedMember, workspace } from './support';

for (const role of ['company_admin', 'equipment_manager'])
  test(`${role} edits and archives catalog records without changing physical custody`, async ({ page, browser }) => {
    const fixture = await workspace(page);
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
    const actor = role === 'company_admin' ? page : await context.newPage();
    try {
      if (actor !== page) await invitedMember(page, actor, fixture.base, role, 'Equipment reviewer');
      const before = (await (await page.request.get(`${fixture.base}/tools`)).json()).items;
      await actor.goto('/app/catalog');
      const models = actor.getByRole('region', { name: 'Models', exact: true });
      const model = models.locator('details');
      await expect(model).toHaveCount(1);
      await model.locator('summary').click();
      await model.getByLabel('Tool name', { exact: true }).fill('Combi drill');
      await model.getByLabel('Model number').fill('C100');
      await model.getByRole('button', { name: 'Save model', exact: true }).click();
      await expect(model.getByRole('status')).toBeVisible();
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
      await model.getByLabel('Archived', { exact: true }).check();
      await model.getByRole('button', { name: 'Save model', exact: true }).click();
      await expect(model).toHaveCount(0);
      await actor.getByLabel('Show archived records').click();
      await expect(actor.getByLabel('Show archived records')).toBeChecked();
      await expect(model).toHaveCount(1);
      await model.locator('summary').click();
      await expect(model.getByLabel('Category', { exact: true })).toHaveValue(fixture.asset.category_id);
      await model.getByLabel('Archived', { exact: true }).uncheck();
      await model.getByRole('button', { name: 'Save model', exact: true }).click();
      await expect(model).toHaveCount(0);
      await actor.getByLabel('Show archived records').click();
      await expect(actor.getByLabel('Show archived records')).not.toBeChecked();
      const categories = actor.getByRole('region', { name: 'Categories', exact: true });
      const category = categories.locator('details');
      await expect(category).toHaveCount(1);
      await category.locator('summary').click();
      await category.getByLabel('Category name').fill('Historical drills');
      await category.getByLabel('Archived', { exact: true }).check();
      await category.getByRole('button', { name: 'Save category', exact: true }).click();
      await expect(category).toHaveCount(0);
      await actor.goto('/app/tools/new');
      await actor.getByRole('button', { name: 'Continue without a photo' }).click();
      await expect(
        actor.getByLabel('Tool model').getByRole('option', { name: /Makita Combi drill.*category archived/ }),
      ).toBeDisabled();
      await expect(actor.getByText(/No models are currently eligible/)).toBeVisible();
      await actor.goto('/app/catalog?archived=true');
      await category.locator('summary').click();
      await category.getByLabel('Archived', { exact: true }).uncheck();
      await category.getByRole('button', { name: 'Save category', exact: true }).click();
      await expect(category).toHaveCount(0);
      await actor.goto('/app/tools/new');
      await actor.getByRole('button', { name: 'Continue without a photo' }).click();
      await actor.getByLabel('Tool model').selectOption(fixture.asset.tool_model_id);
      await actor.getByLabel('Starting warehouse').selectOption(fixture.warehouse.id);
      await actor.getByLabel('Unique asset tag').fill('CATALOG-003');
      await actor.getByRole('button', { name: 'Register tool', exact: true }).click();
      await expect(actor.getByRole('link', { name: 'Open its custody record' })).toBeVisible();
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
    const authority = page.getByRole('region', { name: 'Management authority', exact: true });
    await expect(
      authority.getByLabel('Person').getByRole('option', { name: 'Estimator only', exact: true }),
    ).toHaveCount(0);
    await authority.getByLabel('Person').selectOption(member.id);
    await authority.getByRole('button', { name: 'Grant warehouse authority' }).click();
    await expect(authority.getByRole('button', { name: "Revoke Warehouse lead's warehouse access" })).toBeVisible();
    await command(page.request, `${fixture.base}/people/${member.id}/update`, {
      expected_revision: member.revision,
      access_state: 'disabled',
      roles: ['field_member'],
      end_membership: true,
      reason: 'Employment ended',
    });
    await page.reload();
    await expect(authority.getByText('Grant retained; equipment access is currently inactive.')).toBeVisible();
    await authority.getByRole('button', { name: "Revoke Warehouse lead's warehouse access" }).click();
    await expect(authority.getByText('No scoped managers.')).toBeVisible();
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
