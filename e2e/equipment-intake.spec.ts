import { expect } from '@playwright/test';
import { command, invitedMember, workspace, chooseOption, test } from './support';

test('managers create a category while registering equipment without losing their draft', async ({ page }) => {
  const fixture = await workspace(page);
  await page.goto('/app/tools/new');
  const form = page.getByRole('dialog', { name: 'Add a tool', exact: true });
  await form.getByRole('button', { name: 'Continue without a photo' }).click();
  await form.getByLabel('Asset tag', { exact: true }).fill('LAPTOP-001');
  await form.getByRole('button', { name: 'Add tool type', exact: true }).click();
  const type = form.getByRole('group', { name: 'New equipment type' });
  await type.getByLabel('New tool type', { exact: true }).fill('Laptop');
  await chooseOption(type, 'Category', 'new');
  await type.getByLabel('New category', { exact: true }).fill('Computers');
  await type.getByRole('button', { name: 'Save tool type', exact: true }).click();
  await expect(type).toHaveCount(0);
  await expect(form.getByLabel('Asset tag', { exact: true })).toHaveValue('LAPTOP-001');
  await chooseOption(form, 'Home warehouse', fixture.warehouse.id);
  await form.getByRole('button', { name: 'Add tool', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Laptop details', exact: true })).toBeVisible();
});

test('field equipment is reviewed, categorized inline, and private details stay with managers', async ({
  page,
  browser,
}) => {
  const fixture = await workspace(page);
  await command(page.request, `${fixture.base}/tool-registration-policy`, {
    expected_revision: 1,
    employee_tool_creation_enabled: true,
  });
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173', viewport: { width: 390, height: 844 } });
  const worker = await context.newPage();
  try {
    await invitedMember(page, worker, fixture.base, 'field_member', 'Field reporter');
    await worker.goto('/app/mine/new');
    const submit = worker.getByRole('dialog', { name: 'Add a tool', exact: true });
    await submit.getByRole('button', { name: 'Continue without a photo' }).click();
    await expect(submit.getByLabel('Serial number', { exact: true })).toHaveCount(0);
    await expect(submit.getByLabel('Purchase price', { exact: true })).toHaveCount(0);
    await expect(submit.getByLabel('Purchase date', { exact: true })).toHaveCount(0);
    await submit.getByLabel('What is it?', { exact: true }).fill('White pickup truck');
    await submit.getByLabel('Location or job', { exact: true }).fill('Library job');
    await submit.getByRole('button', { name: 'Submit for review' }).click();
    await expect(worker.getByRole('region', { name: 'Reported equipment' })).toContainText('White pickup truck');
    expect((await (await page.request.get(`${fixture.base}/tools`)).json()).items).toHaveLength(2);
    await page.goto('/app/operations');
    const review = page.getByRole('article', { name: 'Submission: White pickup truck', exact: true });
    await review.getByText('Review submission', { exact: true }).click();
    await chooseOption(review, 'Review decision', 'clarify');
    await review.getByLabel('Question for the reporter').fill('Which parking area?');
    await review.getByRole('button', { name: 'Ask for clarification', exact: true }).click();
    await worker.reload();
    const report = worker.getByRole('article', { name: 'Submission: White pickup truck', exact: true });
    await report.getByLabel('Your reply').fill('North lot');
    await report.getByRole('button', { name: 'Send clarification', exact: true }).click();
    await page.reload();
    await review.getByText('Review submission', { exact: true }).click();
    await chooseOption(review, 'Review decision', 'register');
    await review.getByRole('button', { name: 'Add tool type', exact: true }).click();
    const type = review.getByRole('group', { name: 'New equipment type' });
    await type.getByLabel('New tool type', { exact: true }).fill('Pickup truck');
    await chooseOption(type, 'Category', 'new');
    await type.getByLabel('New category', { exact: true }).fill('Vehicles');
    await type.getByRole('button', { name: 'Save tool type', exact: true }).click();
    await expect(type).toHaveCount(0);
    await expect(review.getByRole('combobox', { name: 'Tool type', exact: true })).toHaveText('Pickup truck');
    await chooseOption(review, 'Home warehouse', fixture.warehouse.id);
    await review.getByLabel('Asset tag', { exact: true }).fill('TRUCK-001');
    await review.getByLabel('Serial number', { exact: true }).fill('PRIVATE-VIN');
    await review.getByLabel('Purchase price', { exact: true }).fill('35000');
    await review.getByLabel('Purchase date', { exact: true }).fill('2026-01-01');
    await review.getByRole('button', { name: 'Register equipment', exact: true }).click();
    await expect(review).toHaveCount(0);
    await worker.reload();
    await expect(report).toContainText('Registered');
    const registered = (await (await worker.request.get(`${fixture.base}/tools?search=TRUCK-001`)).json()).items[0];
    expect(registered.holder_name).toBe('Field reporter');
    expect(registered.serial_number).toBeNull();
    expect(registered.acquisition_cost).toBeNull();
    await report.getByRole('link', { name: 'View registered equipment' }).click();
    const details = worker.getByRole('dialog', { name: 'Tool details', exact: true });
    await expect(details).toBeVisible();
    await expect(details.getByText('Serial', { exact: true })).toHaveCount(0);
    await expect(details.getByText('Purchase price', { exact: true })).toHaveCount(0);
    await expect(details.getByText('Purchase date', { exact: true })).toHaveCount(0);
    await expect(details).not.toContainText('PRIVATE-VIN');
    await command(page.request, `${fixture.base}/tool-registration-policy`, {
      expected_revision: 2,
      employee_tool_creation_enabled: false,
    });
    await worker.goto('/app/mine/new');
    await expect(
      worker.getByText('Field inventory collection is closed. Tell a manager if equipment needs to be added.'),
    ).toBeVisible();
    await worker.keyboard.press('Escape');
    await expect(worker.getByRole('link', { name: 'Add a tool', exact: true })).toHaveCount(0);
  } finally {
    await context.close();
  }
});
