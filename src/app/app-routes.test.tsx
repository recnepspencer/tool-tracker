import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppRoutes } from './app-routes';
import { createMemorySessionStore, renderApp } from '../test/render-app';

describe('application route guards', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/';
    document.documentElement.dataset.theme = '';
  });

  it('redirects the root entry to login and opens the worker landing page from Ray', async () => {
    const user = userEvent.setup();
    renderApp(<AppRoutes />);
    expect(await screen.findByRole('heading', { name: 'Sign in to continue' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/login');
    await user.click(await screen.findByRole('button', { name: 'Enter as Ray' }));
    expect(await screen.findByRole('heading', { name: 'My tools' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/worker/tools');
    expect(screen.getAllByText('Hammer drill')).toHaveLength(2);
  });

  it('opens the admin landing page from Sam and denies admin access to worker routes', async () => {
    const user = userEvent.setup();
    renderApp(<AppRoutes />);
    await user.click(await screen.findByRole('button', { name: 'Enter as Sam' }));
    expect(await screen.findByRole('heading', { name: 'Queue' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/admin/operations/queue');
    expect(screen.queryByRole('link', { name: 'Reconciliation' })).not.toBeInTheDocument();
    window.location.hash = '#/admin/reconciliation';
    await waitFor(() => expect(window.location.hash).toBe('#/admin/operations/queue'));
    window.location.hash = '#/worker/tools';
    await waitFor(() => expect(window.location.hash).toBe('#/admin/operations/queue'));
    expect(screen.queryByRole('heading', { name: 'My tools' })).not.toBeInTheDocument();
  });

  it('denies worker access to admin routes', async () => {
    const rayStore = createMemorySessionStore('ray-torres');
    window.location.hash = '#/admin/dashboard';
    renderApp(<AppRoutes />, { sessionStore: rayStore });
    expect(await screen.findByRole('heading', { name: 'My tools' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/worker/tools');
    window.location.hash = '#/admin/dashboard';
    await waitFor(() => expect(window.location.hash).toBe('#/worker/tools'));
    expect(screen.queryByRole('heading', { name: 'Queue' })).not.toBeInTheDocument();
  });

  it('protects an unauthenticated deep link', async () => {
    window.location.hash = '#/admin/dashboard';
    renderApp(<AppRoutes />);
    expect(await screen.findByRole('heading', { name: 'Sign in to continue' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/login');
  });

  it('protects the operations deep links and preserves the requested route for admins', async () => {
    window.location.hash = '#/admin/operations/flagged';
    renderApp(<AppRoutes />);
    expect(await screen.findByRole('heading', { name: 'Sign in to continue' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/login');
    cleanup();
    window.location.hash = '#/admin/operations/inventory';
    renderApp(<AppRoutes />, { sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('heading', { name: 'Inventory' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/admin/operations/inventory');
  });
});
