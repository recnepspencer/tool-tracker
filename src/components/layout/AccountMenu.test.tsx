import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AccountMenu } from './AccountMenu';

const session = {
  profileId: 'ray-torres',
  name: 'Ray Torres',
  role: 'worker' as const,
  email: 'ray@nelsonelectric.com',
  title: 'Journeyman electrician',
  homeWarehouseId: 'north-yard',
  homeWarehouse: 'North Yard',
};

describe('AccountMenu destination labels', () => {
  it('names and links the worker account destination', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AccountMenu
          role="worker"
          session={session}
          onSignOut={() => undefined}
          theme="dark"
          onToggleTheme={() => undefined}
        />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'Open account menu' }));
    expect(screen.getByRole('link', { name: 'Open account page' })).toHaveAttribute('href', '/worker/account');
  });

  it('names and links the admin settings destination', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AccountMenu
          role="admin"
          session={{ ...session, profileId: 'sam-ochoa', name: 'Sam Ochoa', role: 'admin' }}
          onSignOut={() => undefined}
          theme="dark"
          onToggleTheme={() => undefined}
        />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'Open account menu' }));
    expect(screen.getByRole('link', { name: 'Open settings' })).toHaveAttribute('href', '/admin/settings');
  });

  it('keeps the account sheet modal and restores focus after Escape', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AccountMenu
          role="worker"
          session={session}
          onSignOut={() => undefined}
          theme="dark"
          onToggleTheme={() => undefined}
        />
      </MemoryRouter>,
    );
    const trigger = screen.getByRole('button', { name: 'Open account menu' });
    await user.click(trigger);
    const sheet = screen.getByRole('dialog', { name: 'Ray Torres' });
    expect(sheet).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Close account menu' })).toHaveFocus();
    await user.keyboard('{Tab}');
    expect(sheet).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(screen.getByRole('button', { name: 'Close account menu' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Ray Torres' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('keeps the admin account sheet modal and restores focus after keyboard dismissal', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AccountMenu
          role="admin"
          session={{ ...session, profileId: 'sam-ochoa', name: 'Sam Ochoa', role: 'admin' }}
          onSignOut={() => undefined}
          theme="dark"
          onToggleTheme={() => undefined}
        />
      </MemoryRouter>,
    );
    const trigger = screen.getByRole('button', { name: 'Open account menu' });
    await user.click(trigger);
    const sheet = screen.getByRole('dialog', { name: 'Sam Ochoa' });
    expect(sheet).toHaveAttribute('aria-modal', 'true');
    const close = screen.getByRole('button', { name: 'Close account menu' });
    expect(close).toHaveFocus();
    await user.keyboard('{Tab}');
    expect(sheet).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(close).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Sam Ochoa' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
