import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../app/app-routes';
import { createMockApi } from '../../api/mock/create-mock-api';
import type { NelsonApi } from '../../api/contracts';
import { createMemorySessionStore, renderApp } from '../../test/render-app';

function guardedApi(calls: Record<string, number>): NelsonApi {
  const base = createMockApi();
  const guardGroup = <T extends object>(scope: string, group: T): T => {
    const guarded: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(group)) {
      guarded[name] =
        typeof value === 'function'
          ? vi.fn((...args: unknown[]) => {
              const key = `${scope}.${name}`;
              calls[key] = (calls[key] ?? 0) + 1;
              return (value as (...input: unknown[]) => unknown)(...args);
            })
          : value;
    }
    return guarded as T;
  };
  return {
    auth: guardGroup('auth', base.auth),
    tools: guardGroup('tools', base.tools),
    custody: guardGroup('custody', base.custody),
    activity: guardGroup('activity', base.activity),
    admin: guardGroup('admin', base.admin),
    warehouse: guardGroup('warehouse', base.warehouse),
    reconciliation: guardGroup('reconciliation', base.reconciliation),
    settings: guardGroup('settings', base.settings),
  };
}

function storageKeys(storage: Storage) {
  return Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .filter(Boolean)
    .sort();
}

type StorageWrite = { storage: 'local' | 'session'; method: 'setItem' | 'removeItem' | 'clear'; key?: string };
let stopStorageTracking: (() => void) | undefined;

function trackStorageWrites() {
  const writes: StorageWrite[] = [];
  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;
  const originalClear = Storage.prototype.clear;
  const nameFor = (storage: Storage) => (storage === localStorage ? 'local' : 'session');
  const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
    writes.push({ storage: nameFor(this), method: 'setItem', key });
    originalSetItem.call(this, key, value);
  });
  const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, key) {
    writes.push({ storage: nameFor(this), method: 'removeItem', key });
    originalRemoveItem.call(this, key);
  });
  const clear = vi.spyOn(Storage.prototype, 'clear').mockImplementation(function (this: Storage) {
    writes.push({ storage: nameFor(this), method: 'clear' });
    originalClear.call(this);
  });
  const restore = () => [setItem, removeItem, clear].forEach((spy) => spy.mockRestore());
  stopStorageTracking = restore;
  return { writes };
}

function expectOnlyThemeWrite(writes: StorageWrite[]) {
  expect(
    writes.every(
      (write) => write.storage === 'local' && write.method === 'setItem' && write.key === 'nelson-demo-theme',
    ),
  ).toBe(true);
}

afterEach(() => {
  stopStorageTracking?.();
  stopStorageTracking = undefined;
  cleanup();
});

describe('public auth parity routes', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/login';
  });

  it('previews signup and company setup without calling an adapter or persisting the draft', async () => {
    const user = userEvent.setup();
    const calls: Record<string, number> = {};
    const tracking = trackStorageWrites();
    const api = guardedApi(calls);
    window.location.hash = '#/signup';
    renderApp(<AppRoutes />, { api });

    await user.click(await screen.findByRole('button', { name: 'Continue to company setup' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your name.');
    await user.type(screen.getByLabelText('Your name'), 'Morgan Lee');
    await user.type(screen.getByLabelText('Work email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Continue to company setup' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.');
    await user.clear(screen.getByLabelText('Work email'));
    await user.type(screen.getByLabelText('Work email'), 'morgan@example.test');
    await user.click(screen.getByRole('button', { name: 'Continue to company setup' }));
    const companyHeading = await screen.findByRole('heading', { name: 'Name the company space' });
    expect(companyHeading).toBeInTheDocument();
    expect(document.activeElement).toBe(companyHeading);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a company name to continue.');
    await user.type(screen.getByLabelText('Company name'), '   ');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a company name to continue.');
    await user.clear(screen.getByLabelText('Company name'));
    await user.type(screen.getByLabelText('Company name'), 'Preview Electric');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Your workspace is ready' })).toBeInTheDocument();
    expect(Object.values(calls).every((count) => count === 0)).toBe(true);
    expect(storageKeys(localStorage)).toEqual(['nelson-demo-theme']);
    expect(storageKeys(sessionStorage)).toEqual([]);
    expectOnlyThemeWrite(tracking.writes);
  });

  it('shows valid and unknown invitation states without activating a person', async () => {
    const user = userEvent.setup();
    const calls: Record<string, number> = {};
    const tracking = trackStorageWrites();
    window.location.hash = '#/invite/sample-invite';
    renderApp(<AppRoutes />, { api: guardedApi(calls) });
    expect(await screen.findByRole('heading', { name: 'Join the workspace' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Accept invitation' }));
    expect(await screen.findByRole('heading', { name: 'Your invitation is ready' })).toBeInTheDocument();
    expect(Object.values(calls).every((count) => count === 0)).toBe(true);
    expect(storageKeys(localStorage)).toEqual(['nelson-demo-theme']);
    expect(storageKeys(sessionStorage)).toEqual([]);

    cleanup();
    window.location.hash = '#/invite/not-real';
    const unknownCalls: Record<string, number> = {};
    renderApp(<AppRoutes />, { api: guardedApi(unknownCalls) });
    expect(await screen.findByRole('heading', { name: 'That invitation is unavailable' })).toBeInTheDocument();
    expect(screen.getByText('No invitation matches this link.')).toBeInTheDocument();
    expect(Object.values(unknownCalls).every((count) => count === 0)).toBe(true);
    expect(storageKeys(localStorage)).toEqual(['nelson-demo-theme']);
    expect(storageKeys(sessionStorage)).toEqual([]);
    expectOnlyThemeWrite(tracking.writes);
  });

  it('walks through recovery locally and never writes a password', async () => {
    const user = userEvent.setup();
    const calls: Record<string, number> = {};
    const tracking = trackStorageWrites();
    window.location.hash = '#/reset-password';
    renderApp(<AppRoutes />, { api: guardedApi(calls) });
    const email = await screen.findByLabelText('Email address');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.');
    await user.type(email, 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.');
    await user.clear(email);
    await user.type(email, 'ray@example.test');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    const codeHeading = await screen.findByRole('heading', { name: 'Enter the recovery code' });
    expect(document.activeElement).toBe(codeHeading);
    const code = screen.getByLabelText('Recovery code');
    await user.click(screen.getByRole('button', { name: 'Verify code' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the six-digit recovery code 123456.');
    await user.type(code, '123');
    await user.click(screen.getByRole('button', { name: 'Verify code' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the six-digit recovery code 123456.');
    await user.clear(code);
    await user.type(code, '123456');
    await user.click(screen.getByRole('button', { name: 'Verify code' }));
    const passwordHeading = await screen.findByRole('heading', { name: 'Choose a new password' });
    expect(document.activeElement).toBe(passwordHeading);
    const password = screen.getByLabelText('New password');
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Use at least eight characters for your password.');
    await user.type(password, 'short');
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Use at least eight characters for your password.');
    await user.clear(password);
    await user.type(password, 'not-persisted');
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByRole('heading', { name: 'Your recovery steps are complete' })).toBeInTheDocument();
    expect(localStorage.getItem('nelson-demo-password')).toBeNull();
    expect(sessionStorage.getItem('nelson-demo-password')).toBeNull();
    expect(Object.values(calls).every((count) => count === 0)).toBe(true);
    expect(storageKeys(localStorage)).toEqual(['nelson-demo-theme']);
    expect(storageKeys(sessionStorage)).toEqual([]);
    expectOnlyThemeWrite(tracking.writes);
  });

  it('redirects authenticated visitors from every public walkthrough to their role home', async () => {
    const routes = ['/login', '/signup', '/company-setup', '/invite/sample-invite', '/reset-password'];
    for (const [profileId, heading, home] of [
      ['ray-torres', 'My tools', '/worker/tools'],
      ['sam-ochoa', 'Control room', '/admin/dashboard'],
    ] as const) {
      for (const route of routes) {
        cleanup();
        window.location.hash = route;
        renderApp(<AppRoutes />, { sessionStore: createMemorySessionStore(profileId) });
        expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
        await waitFor(() => expect(window.location.hash).toBe(`#${home}`));
      }
    }
  });
});
