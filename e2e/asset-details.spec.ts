import { expect } from '@playwright/test';
import { command, invitedMember, workspace, chooseOption, test } from './support';

for (const role of ['admin', 'manager'])
  test(`${role} registers purchase details for one physical tool and a manager can edit or clear them`, async ({
    page,
    browser,
  }) => {
    const fixture = await workspace(page);
    await command(page.request, `${fixture.base}/tool-registration-policy`, {
      expected_revision: 1,
      employee_tool_creation_enabled: true,
    });
    const context = await browser.newContext({
      baseURL: 'http://127.0.0.1:4173',
      viewport: { width: 390, height: 844 },
    });
    const actor = role === 'admin' ? page : await context.newPage();
    try {
      if (actor !== page) await invitedMember(page, actor, fixture.base, role);
      // Only managers and admins register tools; foremen submit equipment for review.
      await actor.goto('/app/tools/new');
      const sheet = actor.getByRole('dialog', { name: 'Add a tool', exact: true });
      await chooseOption(sheet, 'Tool model', fixture.asset.tool_model_id);
      await chooseOption(sheet, 'Home warehouse', fixture.warehouse.id);
      // The optional details stay folded away until asked for.
      const more = sheet.getByRole('button', { name: 'More details', exact: true });
      await expect(more).toHaveAttribute('aria-expanded', 'false');
      await expect(sheet.getByLabel('Serial number', { exact: true })).toBeHidden();
      await more.click();
      await expect(more).toHaveAttribute('aria-expanded', 'true');
      await expect(sheet.getByLabel('Currency')).toHaveCount(0);
      await sheet.getByLabel('Serial number', { exact: true }).fill('SERIAL-003');
      await sheet.getByLabel('Purchase price', { exact: true }).fill('249.95');
      await sheet.getByLabel('Purchase date', { exact: true }).fill('2026-04-12');
      await sheet.getByLabel('Notes', { exact: true }).fill('Two batteries included.\nKeep the case with this tool.');
      // Attaching and removing a photo keeps the details already typed.
      await sheet.getByLabel('Tool photo', { exact: true }).setInputFiles('e2e/fixtures/hammer-drill.jpg');
      await sheet.getByRole('button', { name: 'Remove photo', exact: true }).click();
      await expect(sheet.getByRole('img', { name: 'Selected tool', exact: true })).toHaveCount(0);
      await expect(sheet.getByLabel('Purchase price', { exact: true })).toHaveValue('249.95');
      await expect(sheet.getByLabel('Notes', { exact: true })).toHaveValue(
        'Two batteries included.\nKeep the case with this tool.',
      );
      await sheet.getByRole('button', { name: 'Add tool', exact: true }).click();
      // The wizard closes onto the new tool's record.
      await expect(sheet).toHaveCount(0);
      const createdId = new URL(actor.url()).pathname.split('/').pop();
      const tool = actor.getByRole('dialog', {
        name: 'Hammer drill details',
        exact: true,
      });
      await expect(tool.getByText('$249.95', { exact: true })).toBeVisible();
      await expect(tool.getByText('Apr 12, 2026', { exact: true })).toBeVisible();
      await expect(
        tool.getByText('Two batteries included.\nKeep the case with this tool.', { exact: true }),
      ).toBeVisible();
      const created = await (await actor.request.get(`${fixture.base}/tools/${createdId}`)).json();
      expect(created).toMatchObject({
        acquisition_cost: '249.95',
        acquisition_date: '2026-04-12',
        serial_number: 'SERIAL-003',
        notes: 'Two batteries included.\nKeep the case with this tool.',
        tool_model_id: fixture.asset.tool_model_id,
        warehouse_id: fixture.warehouse.id,
      });
      const custody = await (await page.request.get(`${fixture.base}/tools/${created.id}/custody`)).json();
      const unchanged = (await (await page.request.get(`${fixture.base}/tools`)).json()).items.filter(
        (asset: { id: string }) => asset.id !== created.id,
      );
      const manager = actor;
      const managerTool = manager.getByRole('dialog', { name: 'Hammer drill details', exact: true });
      const edit = manager.getByRole('dialog', { name: 'Edit Hammer drill', exact: true });
      await managerTool.getByRole('button', { name: 'Edit', exact: true }).click();
      await expect(edit.getByLabel('Purchase price', { exact: true })).toHaveValue('249.95');
      await expect(edit.getByLabel('Currency')).toHaveCount(0);
      await edit.getByLabel('Purchase price', { exact: true }).fill('0');
      await edit.getByLabel('Notes', { exact: true }).fill('Warranty replacement.');
      await edit.getByRole('button', { name: 'Save changes', exact: true }).click();
      await expect(edit).toHaveCount(0);
      await expect(managerTool.getByText('$0.00', { exact: true })).toBeVisible();
      await manager.reload();
      await managerTool.getByRole('button', { name: 'Edit', exact: true }).click();
      await expect(edit.getByLabel('Purchase price', { exact: true })).toHaveValue('0.00');
      await expect(edit.getByLabel('Notes', { exact: true })).toHaveValue('Warranty replacement.');
      if (role === 'manager') {
        await manager.screenshot({ path: 'artifacts/asset-purchase-details-desktop.png', fullPage: true });
        await actor.reload();
        await expect(tool.getByText('$0.00', { exact: true })).toBeVisible();
        await tool.getByText('Warranty replacement.', { exact: true }).scrollIntoViewIfNeeded();
        await actor.screenshot({ path: 'artifacts/asset-purchase-details-mobile.png', fullPage: true });
      }
      await edit.getByLabel('Purchase price', { exact: true }).fill('');
      await edit.getByLabel('Purchase date', { exact: true }).fill('');
      await edit.getByLabel('Notes', { exact: true }).fill('');
      await edit.getByRole('button', { name: 'Save changes', exact: true }).click();
      await expect(edit).toHaveCount(0);
      await expect(managerTool.getByText('$0.00', { exact: true })).toHaveCount(0);
      const final = await (await page.request.get(`${fixture.base}/tools/${created.id}`)).json();
      expect(final).toMatchObject({
        acquisition_cost: null,
        acquisition_date: null,
        notes: '',
      });
      expect(await (await page.request.get(`${fixture.base}/tools/${created.id}/custody`)).json()).toEqual(custody);
      expect(
        (await (await page.request.get(`${fixture.base}/tools`)).json()).items.filter(
          (asset: { id: string }) => asset.id !== created.id,
        ),
      ).toEqual(unchanged);
    } finally {
      await context.close();
    }
  });
