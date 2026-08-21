import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppRoutes } from '../../app/app-routes';
import { createMemorySessionStore, renderApp } from '../../test/render-app';

describe('worker account surfaces', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/worker/account';
  });

  it('renders authenticated profile metadata on the account page', async () => {
    renderApp(<AppRoutes />, { sessionStore: createMemorySessionStore('ray-torres') });
    expect(await screen.findByRole('heading', { name: 'Your account' })).toBeInTheDocument();
    expect(screen.getByText('Journeyman electrician')).toBeInTheDocument();
    expect(screen.getByText('North Yard')).toBeInTheDocument();
  });

  it('keeps the account sheet and mobile navigation controls reachable', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/worker/tools';
    renderApp(<AppRoutes />, { sessionStore: createMemorySessionStore('ray-torres') });
    await screen.findByRole('heading', { name: 'My tools' });
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    await user.click(screen.getByRole('button', { name: 'Account' }));
    const accountDialog = screen.getByRole('dialog', { name: 'Ray Torres' });
    expect(within(accountDialog).getByText('ray@nelsonelectric.com')).toBeInTheDocument();
    expect(within(accountDialog).getByText(/Journeyman electrician/)).toBeInTheDocument();
    await user.click(within(accountDialog).getByRole('button', { name: 'Close account menu' }));
    await user.click(screen.getByLabelText('Open navigation'));
    const navigation = screen.getByRole('dialog', { name: 'Worker navigation' });
    expect(navigation).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveFocus();
    await user.keyboard('{Tab}');
    expect(navigation).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Worker navigation' })).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('Open navigation'));
    await user.click(screen.getByRole('button', { name: 'Close navigation' }));
    expect(screen.getByLabelText('Open navigation')).toHaveFocus();
  });
});
