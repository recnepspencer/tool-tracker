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

  it('renders authenticated profile metadata from the worker identity control', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/worker/tools';
    renderApp(<AppRoutes />, { sessionStore: createMemorySessionStore('ray-torres') });
    await screen.findByRole('heading', { name: 'My tools' });
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    await user.click(screen.getByRole('button', { name: 'Open account for Ray Torres' }));
    const account = screen.getByRole('dialog', { name: 'Ray Torres' });
    expect(within(account).getByText(/Journeyman electrician/)).toBeInTheDocument();
    expect(within(account).getByText(/North Yard/)).toBeInTheDocument();
    expect(within(account).queryByText('Member since')).not.toBeInTheDocument();
  });

  it('keeps the account sheet and mobile navigation controls reachable', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/worker/tools';
    renderApp(<AppRoutes />, { sessionStore: createMemorySessionStore('ray-torres') });
    await screen.findByRole('heading', { name: 'My tools' });
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    const navigation = screen.getByRole('dialog', { name: 'Worker navigation' });
    expect(within(navigation).getByRole('switch', { name: 'Appearance' })).toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: 'My tools' })).toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: 'Checkout' })).toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: 'Activity' })).toBeInTheDocument();
    expect(within(navigation).getByRole('button', { name: 'Add a tool' })).toBeInTheDocument();
    expect(within(navigation).queryByText('Warehouses')).not.toBeInTheDocument();
    expect(navigation.querySelectorAll('.worker-drawer-link-icon')).toHaveLength(4);
    const theme = navigation.querySelector('.worker-drawer-theme');
    expect(theme).not.toBeNull();
    expect(navigation.querySelector('.worker-drawer-nav')!.compareDocumentPosition(theme!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    await user.click(within(navigation).getByRole('button', { name: 'Open account for Ray Torres' }));
    const accountDialog = screen.getByRole('dialog', { name: 'Ray Torres' });
    expect(within(accountDialog).queryByRole('switch', { name: 'Appearance' })).not.toBeInTheDocument();
    expect(within(accountDialog).getByText('ray@nelsonelectric.com')).toBeInTheDocument();
    expect(within(accountDialog).getByText(/Journeyman electrician/)).toBeInTheDocument();
    await user.click(within(accountDialog).getByRole('button', { name: 'Close account menu' }));
    await user.click(screen.getByLabelText('Open navigation'));
    const reopenedNavigation = screen.getByRole('dialog', { name: 'Worker navigation' });
    expect(reopenedNavigation).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveFocus();
    await user.keyboard('{Tab}');
    expect(reopenedNavigation).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Worker navigation' })).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('Open navigation'));
    await user.click(screen.getByRole('button', { name: 'Close navigation' }));
    expect(screen.getByLabelText('Open navigation')).toHaveFocus();
  });
});
