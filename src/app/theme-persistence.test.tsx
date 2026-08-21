import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppRoutes } from './app-routes';
import { createMemoryThemeStore, renderApp } from '../test/render-app';

describe('theme persistence boundary', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/login';
    document.documentElement.dataset.theme = '';
  });

  it('toggles and persists the deterministic light theme across remount', async () => {
    const user = userEvent.setup();
    renderApp(<AppRoutes />);
    await user.click(await screen.findByRole('button', { name: 'Enter as Ray' }));
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    await user.click(screen.getByRole('button', { name: 'Account' }));
    await user.click(await screen.findByRole('switch', { name: 'Light mode' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('nelson-demo-theme')).toBe('light');
    cleanup();
    window.location.hash = '#/worker/tools';
    renderApp(<AppRoutes />);
    expect(await screen.findByRole('heading', { name: 'My tools' })).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('uses an injected theme store for replaceable persistence', async () => {
    const user = userEvent.setup();
    const themeStore = createMemoryThemeStore();
    renderApp(<AppRoutes />, { themeStore });
    await user.click(await screen.findByRole('button', { name: 'Enter as Ray' }));
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    await user.click(screen.getByRole('button', { name: 'Account' }));
    await user.click(await screen.findByRole('switch', { name: 'Light mode' }));
    expect(themeStore.value).toBe('light');
    cleanup();
    window.location.hash = '#/worker/tools';
    renderApp(<AppRoutes />, { themeStore });
    expect(await screen.findByRole('heading', { name: 'My tools' })).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
