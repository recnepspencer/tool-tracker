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

  it('validates signup and fails company setup closed without claiming persistence', async () => {
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
    await user.type(screen.getByLabelText('Company name'), 'Nelson Electric');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Workspace creation is currently unavailable');
    expect(screen.queryByText('Your workspace is ready')).not.toBeInTheDocument();
    expect(Object.values(calls).every((count) => count === 0)).toBe(true);
    expect(storageKeys(localStorage)).toEqual(['nelson-demo-theme']);
    expect(storageKeys(sessionStorage)).toEqual([]);
    expectOnlyThemeWrite(tracking.writes);
  });

  it('does not expose or accept a fixed invitation without invitation authority', async () => {
    const calls: Record<string, number> = {};
    const tracking = trackStorageWrites();
    window.location.hash = '#/invite/invite-token';
    renderApp(<AppRoutes />, { api: guardedApi(calls) });
    expect(await screen.findByRole('heading', { name: 'That invitation is unavailable' })).toBeInTheDocument();
    expect(screen.getByText('Ask an administrator for a current invitation.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept invitation' })).not.toBeInTheDocument();
    expect(Object.values(calls).every((count) => count === 0)).toBe(true);
    expect(storageKeys(localStorage)).toEqual(['nelson-demo-theme']);
    expect(storageKeys(sessionStorage)).toEqual([]);

    cleanup();
    window.location.hash = '#/invite/not-real';
    const unknownCalls: Record<string, number> = {};
    renderApp(<AppRoutes />, { api: guardedApi(unknownCalls) });
    expect(await screen.findByRole('heading', { name: 'That invitation is unavailable' })).toBeInTheDocument();
    expect(screen.getByText('Ask an administrator for a current invitation.')).toBeInTheDocument();
    expect(Object.values(unknownCalls).every((count) => count === 0)).toBe(true);
    expect(storageKeys(localStorage)).toEqual(['nelson-demo-theme']);
    expect(storageKeys(sessionStorage)).toEqual([]);
    expectOnlyThemeWrite(tracking.writes);
  });

  it('fails recovery closed without simulating a code or password update', async () => {
    const user = userEvent.setup();
    const calls: Record<string, number> = {};
    const tracking = trackStorageWrites();
    window.location.hash = '#/reset-password';
    renderApp(<AppRoutes />, { api: guardedApi(calls) });
    const email = await screen.findByLabelText('Email address');
    await user.click(screen.getByRole('button', { name: 'Request recovery link' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.');
    await user.type(email, 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Request recovery link' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.');
    await user.clear(email);
    await user.type(email, 'ray@example.test');
    await user.click(screen.getByRole('button', { name: 'Request recovery link' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Account recovery is currently unavailable');
    expect(screen.queryByLabelText('Recovery code')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
    expect(localStorage.getItem('nelson-demo-password')).toBeNull();
    expect(sessionStorage.getItem('nelson-demo-password')).toBeNull();
    expect(Object.values(calls).every((count) => count === 0)).toBe(true);
    expect(storageKeys(localStorage)).toEqual(['nelson-demo-theme']);
    expect(storageKeys(sessionStorage)).toEqual([]);
    expectOnlyThemeWrite(tracking.writes);
  });

  it('redirects authenticated visitors from every public walkthrough to their role home', async () => {
    const routes = ['/login', '/signup', '/company-setup', '/invite/invite-token', '/reset-password'];
    for (const [profileId, heading, home] of [
      ['ray-torres', 'My tools', '/worker/tools'],
      ['sam-ochoa', 'Queue', '/admin/operations/queue'],
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
