import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { onlineManager } from '@tanstack/react-query';
import { createMockApi } from '../../api/mock/create-mock-api';
import { AppRoutes } from '../../app/app-routes';
import { queryKeys } from '../../api/query-keys';
import { createMemorySessionStore, renderApp } from '../../test/render-app';
import { chooseFieldOption, openFieldOptions } from '../../test/choose-field-option';

function InvalidateCaseyDetail() {
  const queryClient = useQueryClient();
  return (
    <button
      type="button"
      onClick={() =>
        void queryClient.invalidateQueries({
          queryKey: queryKeys.adminPerson('sam-ochoa', 'casey-reed'),
          refetchType: 'all',
        })
      }
    >
      Refresh Casey detail
    </button>
  );
}

function InvalidateAdminPeople() {
  const queryClient = useQueryClient();
  return (
    <button
      type="button"
      onClick={() => void queryClient.invalidateQueries({ queryKey: queryKeys.adminPeopleRoot, refetchType: 'all' })}
    >
      Refresh admin people
    </button>
  );
}

describe('admin action safety', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/admin/people';
  });

  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('keeps invite drafts and disables repeated submits while the command is pending', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    let calls = 0;
    let rejectInvite: (error: Error) => void = () => undefined;
    const api = {
      ...baseApi,
      admin: {
        ...baseApi.admin,
        invitePerson: async () => {
          calls += 1;
          await new Promise<never>((_, reject) => {
            rejectInvite = reject;
          });
          throw new Error('Invite rejected');
        },
      },
    };
    renderApp(<AppRoutes />, { api, sessionStore: createMemorySessionStore('sam-ochoa') });
    await user.click(await screen.findByRole('button', { name: 'Invite person' }));
    const dialog = await screen.findByRole('dialog', { name: 'Invite a person' });
    await user.type(within(dialog).getByLabelText('Name'), 'Jamie Park');
    await user.type(within(dialog).getByLabelText('Email'), 'jamie@example.com');
    await user.type(within(dialog).getByLabelText('Title'), 'Estimator');
    const submit = within(dialog).getByRole('button', { name: 'Send invite' });
    await user.click(submit);
    await waitFor(() => expect(submit).toBeDisabled());
    await user.click(submit);
    expect(calls).toBe(1);
    rejectInvite(new Error('Invite rejected'));
    expect(await screen.findByText('Invite rejected')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Jamie Park');
    expect(within(dialog).getByLabelText('Email')).toHaveValue('jamie@example.com');
    expect(within(dialog).getByLabelText('Title')).toHaveValue('Estimator');
    expect(within(dialog).getByLabelText('Role')).toHaveValue('Worker');
    expect(within(dialog).getByLabelText('Home warehouse')).toHaveValue('North Yard');
  });

  it('renders a truthful adapter error when the people query fails', async () => {
    const baseApi = createMockApi();
    const api = {
      ...baseApi,
      admin: {
        ...baseApi.admin,
        listPeople: async () => {
          throw new Error('directory offline');
        },
      },
    };
    renderApp(<AppRoutes />, { api, sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('alert')).toHaveTextContent('directory could not be loaded');
  });

  it('keeps a warehouse draft after a rejected command and exposes only eligible managers', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    const api = {
      ...baseApi,
      admin: {
        ...baseApi.admin,
        createWarehouse: async () => {
          throw new Error('warehouse unavailable');
        },
      },
    };
    window.location.hash = '#/admin/warehouses';
    renderApp(<AppRoutes />, { api, sessionStore: createMemorySessionStore('sam-ochoa') });
    await user.click(await screen.findByRole('button', { name: 'Add warehouse' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create warehouse' });
    const managerOptions = await openFieldOptions(user, within(dialog).getByRole('combobox', { name: 'Manager' }));
    expect(within(managerOptions).getByRole('option', { name: /Morgan Price/ })).toBeInTheDocument();
    expect(within(managerOptions).queryByRole('option', { name: /Taylor Nguyen/ })).not.toBeInTheDocument();
    await user.click(within(managerOptions).getByRole('option', { name: /Morgan Price/ }));
    await user.type(within(dialog).getByLabelText('Name'), 'West Annex');
    await user.type(within(dialog).getByLabelText('Address'), '9 Line Ave');
    await user.click(within(dialog).getByRole('button', { name: 'Save warehouse' }));
    expect(await screen.findByText('warehouse unavailable')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Name')).toHaveValue('West Annex');
    expect(within(dialog).getByLabelText('Address')).toHaveValue('9 Line Ave');
    expect(within(dialog).getByLabelText('Manager')).toHaveValue('Morgan Price');
  });

  it('blocks cached admin commands while their authoritative people query is refreshing', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    let listCalls = 0;
    let resolveRefresh: (() => void) | undefined;
    const api = {
      ...baseApi,
      admin: {
        ...baseApi.admin,
        listPeople: async (input: { actorId: string }) => {
          listCalls += 1;
          if (listCalls > 1) {
            await new Promise<void>((resolve) => {
              resolveRefresh = resolve;
            });
          }
          return baseApi.admin.listPeople(input);
        },
      },
    };
    renderApp(
      <>
        <AppRoutes />
        <InvalidateAdminPeople />
      </>,
      { api, sessionStore: createMemorySessionStore('sam-ochoa') },
    );
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('link', { name: 'Casey Reed' }));
    const drawer = await screen.findByRole('dialog', { name: 'Person details for Casey Reed' });
    await chooseFieldOption(user, within(drawer).getByLabelText('Role'), 'Warehouse manager');
    const saveRole = within(drawer).getByRole('button', { name: 'Save role' });
    expect(saveRole).not.toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Refresh admin people' }));
    await waitFor(() => expect(listCalls).toBe(2));
    expect(saveRole).toBeDisabled();
    resolveRefresh?.();
    await waitFor(() => expect(saveRole).not.toBeDisabled());
  });

  it('pauses cached admin commands while the online manager is offline', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    let roleCalls = 0;
    const api = {
      ...baseApi,
      admin: {
        ...baseApi.admin,
        updatePersonRole: async (input: {
          actorId: string;
          personId: string;
          role: 'worker' | 'warehouse-manager' | 'admin';
        }) => {
          roleCalls += 1;
          return baseApi.admin.updatePersonRole(input);
        },
      },
    };
    renderApp(
      <>
        <AppRoutes />
        <InvalidateAdminPeople />
      </>,
      { api, sessionStore: createMemorySessionStore('sam-ochoa') },
    );
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('link', { name: 'Casey Reed' }));
    const drawer = await screen.findByRole('dialog', { name: 'Person details for Casey Reed' });
    await chooseFieldOption(user, within(drawer).getByLabelText('Role'), 'Warehouse manager');
    const saveRole = within(drawer).getByRole('button', { name: 'Save role' });
    onlineManager.setOnline(false);
    await user.click(screen.getByRole('button', { name: 'Refresh admin people' }));
    await waitFor(() => expect(saveRole).toBeDisabled());
    await user.click(saveRole);
    expect(roleCalls).toBe(0);
    onlineManager.setOnline(true);
    await waitFor(() => expect(saveRole).not.toBeDisabled());
  });

  it('fails closed when a cached person detail refetch errors', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    let detailCalls = 0;
    let roleCalls = 0;
    const api = {
      ...baseApi,
      admin: {
        ...baseApi.admin,
        getPerson: async (input: { actorId: string; personId: string }) => {
          detailCalls += 1;
          if (detailCalls > 1) throw new Error('person detail unavailable');
          return baseApi.admin.getPerson(input);
        },
        updatePersonRole: async (input: {
          actorId: string;
          personId: string;
          role: 'worker' | 'warehouse-manager' | 'admin';
        }) => {
          roleCalls += 1;
          return baseApi.admin.updatePersonRole(input);
        },
      },
    };
    renderApp(
      <>
        <AppRoutes />
        <InvalidateCaseyDetail />
      </>,
      { api, sessionStore: createMemorySessionStore('sam-ochoa') },
    );
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('link', { name: 'Casey Reed' }));
    const drawer = await screen.findByRole('dialog', { name: 'Person details for Casey Reed' });
    await chooseFieldOption(user, within(drawer).getByLabelText('Role'), 'Warehouse manager');
    await user.click(screen.getByRole('button', { name: 'Refresh Casey detail' }));
    await waitFor(() => expect(detailCalls).toBe(2));
    expect(await screen.findByText('That person could not be loaded.')).toBeInTheDocument();
    const saveRole = screen.queryByRole('button', { name: 'Save role' });
    if (saveRole) expect(saveRole).toBeDisabled();
    expect(roleCalls).toBe(0);
  });
});
