import { expect, type APIRequestContext, type Page, type Cookie } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function command(request: APIRequestContext, path: string, data: unknown) {
  const csrf = await (await request.get('/api/auth/csrf')).json();
  const response = await request.post(path, { data, headers: { 'X-CSRFToken': csrf.csrf_token } });
  expect(response.ok(), `${path}: ${await response.text()}`).toBe(true);
  return response.json();
}

// Authentication has a longer lifetime than a company's fixture data. Establish
// one verified owner through public endpoints per worker, then retain its real
// session cookie while each scenario creates an independent company.
let ownerCookies: Cookie[] | undefined;
export async function workspace(page: Page) {
  const suffix = crypto.randomUUID().slice(0, 8);
  if (ownerCookies) await page.context().addCookies(ownerCookies);
  else {
    const email = `workspace-${suffix}@example.com`;
    await command(page.request, '/api/auth/signup', { email, name: 'Workspace Owner' });
    const link = new URL(await emailLink(email, '/verify-email'), 'http://localhost');
    await command(page.request, '/api/auth/verify-signup', { token: link.searchParams.get('token'), password });
    ownerCookies = await page.context().cookies();
  }
  const company = await command(page.request, '/api/companies', {
    request_key: crypto.randomUUID(),
    name: `Company ${suffix}`,
    preferred_name: 'Workspace Owner',
  });
  const base = `/api/companies/${company.id}`;
  const warehouse = await command(page.request, `${base}/warehouses`, { code: 'MAIN', name: 'Main warehouse' });
  const category = await command(page.request, `${base}/tool-categories`, { name: 'Drills' });
  const model = await command(page.request, `${base}/tool-models`, {
    category_id: category.id,
    name: 'Hammer drill',
    manufacturer: 'Makita',
    model_number: 'XPH14',
  });
  const asset = await command(page.request, `${base}/tools`, {
    request_key: crypto.randomUUID(),
    tool_model_id: model.id,
    warehouse_id: warehouse.id,
    asset_tag: 'UNIT-001',
  });
  const second = await command(page.request, `${base}/tools`, {
    request_key: crypto.randomUUID(),
    tool_model_id: model.id,
    warehouse_id: warehouse.id,
    asset_tag: 'UNIT-002',
  });
  const project = await command(page.request, `${base}/projects`, { number: 'P1', name: 'Library' });
  const job = await command(page.request, `${base}/jobs`, {
    project_id: project.id,
    number: 'J1',
    name: 'Library wiring',
  });
  await page.addInitScript((id) => {
    if (!sessionStorage.getItem('nelson.company')) sessionStorage.setItem('nelson.company', id);
  }, company.id);
  await page.goto('/app/tools');
  await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();
  return { company, base, warehouse, asset, second, job };
}
export const password = 'Real-browser-test-password-2026';
export async function invitedMember(owner: Page, memberPage: Page, base: string, role: string, name = 'Alex Rivera') {
  const email = `role-${crypto.randomUUID().slice(0, 12)}@example.com`;
  const invitation = await command(owner.request, `${base}/invitations`, { email, preferred_name: name, role });
  await command(memberPage.request, '/api/auth/signup', { email, name });
  const verification = new URL(await emailLink(email, '/verify-email'), 'http://localhost');
  await command(memberPage.request, '/api/auth/verify-signup', {
    token: verification.searchParams.get('token'),
    password,
  });
  return command(memberPage.request, '/api/invitations/accept', { token: invitation.token });
}
const mailDir = resolve('artifacts/mail');
export async function emailLink(email: string, path: string) {
  let link = '';
  await expect
    .poll(async () => {
      for (const file of (await readdir(mailDir)).reverse()) {
        const body = await readFile(resolve(mailDir, file), 'utf8');
        if (body.includes(`To: ${email}`) && body.includes(path)) {
          const found = body.match(new RegExp(`https?://[^\\s]*${path}[^\\s]*`));
          if (found) {
            const url = new URL(found[0]);
            link = url.pathname + url.search;
            return true;
          }
        }
      }
      return false;
    })
    .toBe(true);
  return link;
}
