import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { createMockApi } from '../../api/mock/create-mock-api';
import { AppRoutes } from '../../app/app-routes';
import { createMemorySessionStore, renderApp } from '../../test/render-app';

afterEach(cleanup);

describe('jobs workflows', () => {
  it('lets an admin add and archive a job with a retained archived entry', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/admin/settings';
    renderApp(<AppRoutes />, { sessionStore: createMemorySessionStore('sam-ochoa') });
    await user.click(await screen.findByRole('button', { name: 'Add job' }));
    const dialog = screen.getByRole('dialog', { name: 'Add job' });
    expect(within(dialog).getByRole('textbox', { name: 'Job name' })).not.toHaveFocus();
    await user.type(within(dialog).getByRole('textbox', { name: 'Job name' }), 'Central School');
    await user.click(within(dialog).getByRole('button', { name: 'Add job' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(await screen.findByRole('button', { name: 'Archive Central School' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Archive job' })).getByRole('button', { name: 'Archive job' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByText('Central School')).not.toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Job status' }));
    await user.click(screen.getByRole('option', { name: 'Archived jobs' }));
    expect(await screen.findByRole('button', { name: 'Restore Central School' })).toBeInTheDocument();
  });

  it('saves multiple job choices and exposes them with tools in the directory', async () => {
    const user = userEvent.setup();
    const api = createMockApi();
    window.location.hash = '#/worker/jobs';
    renderApp(<AppRoutes />, { api, sessionStore: createMemorySessionStore('ray-torres') });
    const choice = await screen.findByRole('switch', { name: 'North Office · Fit-out' });
    expect(choice).toHaveAttribute('aria-checked', 'false');
    await user.click(choice);
    await waitFor(() => expect(choice).toHaveAttribute('aria-checked', 'true'));
    expect(screen.getByRole('switch', { name: 'West Wing · Panel upgrade' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    await user.click(screen.getByRole('link', { name: 'Foremen' }));
    await screen.findByRole('heading', { name: 'Foremen' });
    const search = screen.getByRole('searchbox', { name: 'Search foremen, jobs, or tools' });
    await user.type(search, 'Ray');
    expect(
      await screen.findByText('West Wing · Panel upgrade / Riverside · Lighting / North Office · Fit-out'),
    ).toBeInTheDocument();
    expect(screen.getByText('In transfer to Eli Warren')).toBeInTheDocument();
    expect(screen.getByText('Damaged')).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, 'Avery');
    expect(await screen.findByText('No current jobs')).toBeInTheDocument();
    expect(screen.getByText('No tools in custody.')).toBeInTheDocument();
  });
});
