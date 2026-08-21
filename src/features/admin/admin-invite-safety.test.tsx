import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { onlineManager } from '@tanstack/react-query';
import { createMockApi } from '../../api/mock/create-mock-api';
import { AppRoutes } from '../../app/app-routes';
import { queryKeys } from '../../api/query-keys';
import { createMemorySessionStore, renderApp } from '../../test/render-app';

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

function InvalidateAdminWarehouses() {
  const queryClient = useQueryClient();
  return (
    <button
      type="button"
      onClick={() =>
        void queryClient.invalidateQueries({ queryKey: queryKeys.adminWarehousesRoot, refetchType: 'all' })
      }
    >
      Refresh admin warehouses
    </button>
  );
}

describe('admin invite query safety', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/admin/people';
  });

  afterEach(() => onlineManager.setOnline(true));

  it('blocks invite submission while the authoritative people query refetches', async () => {
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
          if (listCalls > 1) await new Promise<void>((resolve) => (resolveRefresh = resolve));
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
    await user.click(await screen.findByRole('button', { name: 'Invite person' }));
    const dialog = await screen.findByRole('dialog', { name: 'Invite a person' });
    const submit = within(dialog).getByRole('button', { name: 'Send invite' });
    await user.type(within(dialog).getByLabelText('Name'), 'Fresh person');
    await user.type(within(dialog).getByLabelText('Email'), 'fresh@nelsonelectric.com');
    await user.type(within(dialog).getByLabelText('Title'), 'Field specialist');
    await waitFor(() => expect(within(dialog).getByLabelText('Home warehouse')).toHaveValue('North Yard'));
    await waitFor(() => expect(submit).not.toBeDisabled());
    await user.click(screen.getByRole('button', { name: 'Refresh admin people' }));
    await waitFor(() => expect(listCalls).toBe(2));
    expect(submit).toBeDisabled();
    resolveRefresh?.();
    await waitFor(() => expect(submit).not.toBeDisabled());
  });

  it('fails closed for invite while the people query errors or is paused offline', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    let errorCalls = 0;
    const errorApi = {
      ...baseApi,
      admin: {
        ...baseApi.admin,
        listPeople: async (input: { actorId: string }) => {
          errorCalls += 1;
          if (errorCalls > 1) throw new Error('directory unavailable');
          return baseApi.admin.listPeople(input);
        },
      },
    };
    renderApp(
      <>
        <AppRoutes />
        <InvalidateAdminPeople />
      </>,
      { api: errorApi, sessionStore: createMemorySessionStore('sam-ochoa') },
    );
    await user.click(await screen.findByRole('button', { name: 'Invite person' }));
    const dialog = await screen.findByRole('dialog', { name: 'Invite a person' });
    const submit = within(dialog).getByRole('button', { name: 'Send invite' });
    await user.type(within(dialog).getByLabelText('Name'), 'Offline person');
    await user.type(within(dialog).getByLabelText('Email'), 'offline@nelsonelectric.com');
    await user.type(within(dialog).getByLabelText('Title'), 'Field specialist');
    await user.click(screen.getByRole('button', { name: 'Refresh admin people' }));
    await waitFor(() => expect(errorCalls).toBeGreaterThanOrEqual(2));
    expect(submit).toBeDisabled();

    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    renderApp(
      <>
        <AppRoutes />
        <InvalidateAdminPeople />
      </>,
      { api: baseApi, sessionStore: createMemorySessionStore('sam-ochoa') },
    );
    await user.click(await screen.findByRole('button', { name: 'Invite person' }));
    const offlineDialog = await screen.findByRole('dialog', { name: 'Invite a person' });
    onlineManager.setOnline(false);
    await user.click(screen.getByRole('button', { name: 'Refresh admin people' }));
    await waitFor(() => expect(within(offlineDialog).getByRole('button', { name: 'Send invite' })).toBeDisabled());
  });

  it('fails closed for invite while the warehouse query refetches, errors, or is paused offline', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    let fetchCalls = 0;
    let releaseRefresh: (() => void) | undefined;
    const fetchingApi = {
      ...baseApi,
      admin: {
        ...baseApi.admin,
        listWarehouses: async (input: { actorId: string }) => {
          fetchCalls += 1;
          if (fetchCalls > 1) await new Promise<void>((resolve) => (releaseRefresh = resolve));
          return baseApi.admin.listWarehouses(input);
        },
      },
    };
    renderApp(
      <>
        <AppRoutes />
        <InvalidateAdminWarehouses />
      </>,
      { api: fetchingApi, sessionStore: createMemorySessionStore('sam-ochoa') },
    );
    await user.click(await screen.findByRole('button', { name: 'Invite person' }));
    const fetchingDialog = await screen.findByRole('dialog', { name: 'Invite a person' });
    const fetchingSubmit = within(fetchingDialog).getByRole('button', { name: 'Send invite' });
    await user.click(screen.getByRole('button', { name: 'Refresh admin warehouses' }));
    await waitFor(() => expect(fetchCalls).toBe(2));
    expect(fetchingSubmit).toBeDisabled();
    releaseRefresh?.();
    await waitFor(() => expect(fetchingSubmit).not.toBeDisabled());

    cleanup();
    let errorCalls = 0;
    const errorApi = {
      ...baseApi,
      admin: {
        ...baseApi.admin,
        listWarehouses: async (input: { actorId: string }) => {
          errorCalls += 1;
          if (errorCalls > 1) throw new Error('warehouse directory unavailable');
          return baseApi.admin.listWarehouses(input);
        },
      },
    };
    renderApp(
      <>
        <AppRoutes />
        <InvalidateAdminWarehouses />
      </>,
      { api: errorApi, sessionStore: createMemorySessionStore('sam-ochoa') },
    );
    await user.click(await screen.findByRole('button', { name: 'Invite person' }));
    const errorDialog = await screen.findByRole('dialog', { name: 'Invite a person' });
    await user.click(screen.getByRole('button', { name: 'Refresh admin warehouses' }));
    await waitFor(() => expect(errorCalls).toBe(2));
    expect(within(errorDialog).getByRole('button', { name: 'Send invite' })).toBeDisabled();

    cleanup();
    renderApp(
      <>
        <AppRoutes />
        <InvalidateAdminWarehouses />
      </>,
      { api: baseApi, sessionStore: createMemorySessionStore('sam-ochoa') },
    );
    await user.click(await screen.findByRole('button', { name: 'Invite person' }));
    const offlineDialog = await screen.findByRole('dialog', { name: 'Invite a person' });
    onlineManager.setOnline(false);
    await user.click(screen.getByRole('button', { name: 'Refresh admin warehouses' }));
    await waitFor(() => expect(within(offlineDialog).getByRole('button', { name: 'Send invite' })).toBeDisabled());
  });
});
