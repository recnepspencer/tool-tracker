import { expect, test as base, type APIRequestContext, type Locator, type Page, type Cookie } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

// The suite's API trusts its local proxy, so each scenario arrives from its own client
// address and gets its own authentication throttle window, like a separate person would.
const address = () => ({ 'X-Real-IP': `scenario-${crypto.randomUUID()}` });
export const test = base.extend<{ separateAddresses: void }>({
  extraHTTPHeaders: async ({ extraHTTPHeaders }, use) => use({ ...extraHTTPHeaders, ...address() }),
  // Other people in a scenario open their own contexts; each arrives from its own address too.
  separateAddresses: [
    async ({ browser }, use) => {
      const newContext = browser.newContext.bind(browser);
      browser.newContext = (options = {}) =>
        newContext({ ...options, extraHTTPHeaders: { ...options.extraHTTPHeaders, ...address() } });
      await use();
      browser.newContext = newContext;
    },
    { auto: true },
  ],
});

// Django rotates the CSRF cookie on login, so read the current one from the jar and
// only ask the API for a token when the context has none yet.
async function csrfToken(request: APIRequestContext) {
  const { cookies } = await request.storageState();
  const cookie = cookies.find((candidate) => candidate.name === 'csrftoken');
  if (cookie) return cookie.value;
  return (await (await request.get('/api/auth/csrf')).json()).csrf_token as string;
}
export async function command(request: APIRequestContext, path: string, data: unknown) {
  const response = await request.post(path, { data, headers: { 'X-CSRFToken': await csrfToken(request) } });
  expect(response.ok(), `${path}: ${await response.text()}`).toBe(true);
  return response.json();
}

// Every new company needs a single-use signup code. Each worker issues a batch from the
// suite's database with the same command an operator uses, and refills it when empty.
const codes: string[] = [];
export function signupCode() {
  if (!codes.length) {
    const python = resolve('backend/.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    const issued = spawnSync(
      python,
      ['backend/manage.py', 'signup_codes', 'create', '--count', '40', '--days', '1', '--label', 'browser suite'],
      { encoding: 'utf8' },
    );
    if (issued.status !== 0) throw new Error(`Could not issue signup codes: ${issued.stderr}`);
    codes.push(...issued.stdout.split(/\s+/).filter(Boolean));
  }
  return codes.pop()!;
}

// Authentication has a longer lifetime than a company's fixture data. Establish
// one verified owner through public endpoints per worker, then retain its real
// session cookie while each scenario creates an independent company.
let ownerCookies: Cookie[] | undefined;
export async function ownedCompany(page: Page) {
  const suffix = crypto.randomUUID().slice(0, 8);
  // The worker's first signup claims a code; every later company spends a fresh one.
  let signup_code = '';
  if (ownerCookies) {
    await page.context().addCookies(ownerCookies);
    signup_code = signupCode();
  } else {
    const email = `workspace-${suffix}@example.com`;
    await command(page.request, '/api/auth/signup', {
      email,
      name: 'Workspace Owner',
      signup_code: signupCode(),
      company_name: `Company ${suffix}`,
    });
    const link = new URL(await emailLink(email, '/verify-email'), 'http://localhost');
    await command(page.request, '/api/auth/verify-signup', { token: link.searchParams.get('token'), password });
    ownerCookies = await page.context().cookies();
  }
  const company = await command(page.request, '/api/companies', {
    request_key: crypto.randomUUID(),
    name: `Company ${suffix}`,
    preferred_name: 'Workspace Owner',
    signup_code,
  });
  const base = `/api/companies/${company.id}`;
  // The shared owner belongs to every scenario's company, so pin this one for every tab.
  await page.context().addInitScript((id) => {
    if (!sessionStorage.getItem('nelson.company')) sessionStorage.setItem('nelson.company', id);
  }, company.id);
  return { company, base };
}
// A company with one warehouse, job and two units of the same tool model.
export async function workspace(page: Page) {
  const { company, base } = await ownedCompany(page);
  const [warehouse, category, project] = await Promise.all([
    command(page.request, `${base}/warehouses`, { code: 'MAIN', name: 'Main warehouse' }),
    command(page.request, `${base}/tool-categories`, { name: 'Drills' }),
    command(page.request, `${base}/projects`, { number: 'P1', name: 'Library' }),
  ]);
  const [model, job] = await Promise.all([
    command(page.request, `${base}/tool-models`, {
      category_id: category.id,
      name: 'Hammer drill',
      manufacturer: 'Makita',
      model_number: 'XPH14',
    }),
    command(page.request, `${base}/jobs`, { project_id: project.id, number: 'J1', name: 'Library wiring' }),
  ]);
  // Sequential so UNIT-001 is the older record wherever lists order by creation.
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
  await page.goto('/app/tools');
  await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();
  return { company, base, warehouse, asset, second, job };
}
export const password = 'Real-browser-test-password-2026';
// Workspace dropdowns are the demo's listbox (a combobox button plus a portal
// popover or bottom sheet), not native selects. Choose by value or by visible label.
export async function chooseOption(
  scope: Page | Locator,
  label: string,
  choice: string | { label: string },
  { exact = true }: { exact?: boolean } = {},
) {
  const page = 'page' in scope ? scope.page() : scope;
  await scope.getByRole('combobox', { name: label, exact }).click();
  const listbox = page.getByRole('listbox', { name: label, exact });
  const option =
    typeof choice === 'string'
      ? listbox.locator(`[role="option"][data-value="${choice}"]`)
      : listbox.getByRole('option', { name: choice.label });
  await option.click();
  await expect(listbox).toBeHidden();
}
// The demo's TransferDestinationPicker: a "Send to" type listbox, then a Person
// or Warehouse listbox submitting the destination.
export async function chooseDestination(page: Page, kind: 'Person' | 'Warehouse', name: string) {
  await chooseOption(page, 'Send to', kind === 'Person' ? 'person' : 'warehouse');
  await chooseOption(page, kind, { label: name });
  await expect(
    page.getByRole('combobox', { name: kind, exact: true }).locator('.field-select-trigger__value'),
  ).toHaveText(name);
}
export async function invitedMember(owner: Page, memberPage: Page, base: string, role: string, name = 'Alex Rivera') {
  const email = `role-${crypto.randomUUID().slice(0, 12)}@example.com`;
  const invitation = await command(owner.request, `${base}/invitations`, { email, preferred_name: name, role });
  await command(memberPage.request, '/api/auth/signup', { email, name, invitation_token: invitation.token });
  const verification = new URL(await emailLink(email, '/verify-email'), 'http://localhost');
  await command(memberPage.request, '/api/auth/verify-signup', {
    token: verification.searchParams.get('token'),
    password,
  });
  return { ...(await command(memberPage.request, '/api/invitations/accept', { token: invitation.token })), email };
}
const mailDir = process.env.NELSON_MAIL_ROOT ?? resolve('artifacts/mail');
// Each worker rereads a mail file only when the backend has appended to it.
const mail = new Map<string, { size: number; body: string }>();
const separator = `\n${'-'.repeat(79)}\n`;
export async function emailLink(email: string, path: string) {
  const pattern = new RegExp(`https?://[^\\s]*${path}[^\\s]*`);
  let link = '';
  await expect
    .poll(async () => {
      for (const file of await readdir(mailDir)) {
        const { size } = await stat(resolve(mailDir, file));
        if (mail.get(file)?.size !== size)
          mail.set(file, { size, body: await readFile(resolve(mailDir, file), 'utf8') });
      }
      for (const { body } of [...mail.values()].reverse())
        // Django ends each message with a dashed line; anything after the last one may be mid-write.
        for (const message of body.split(separator).slice(0, -1).reverse()) {
          if (!message.includes(`To: ${email}`)) continue;
          const found = message.match(pattern);
          if (found) {
            const url = new URL(found[0]);
            link = url.pathname + url.search;
            return true;
          }
        }
      return false;
    })
    .toBe(true);
  return link;
}
