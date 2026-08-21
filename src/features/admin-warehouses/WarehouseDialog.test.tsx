import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';
import { queryKeys } from '../../api/query-keys';
import { createMockApi } from '../../api/mock/create-mock-api';
import { AppProviders } from '../../app/providers';
import { createMemorySessionStore } from '../../test/render-app';
import { WarehouseDialog } from './WarehouseDialog';

const createClient = () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: false } } });

const renderDialog = (api: ReturnType<typeof createMockApi>, queryClient: QueryClient) =>
  render(
    <AppProviders api={api} queryClient={queryClient} sessionStore={createMemorySessionStore('sam-ochoa')}>
      <WarehouseDialog
        warehouse={{ id: 'north-yard', name: 'North Yard', address: '1420 Kerr Ave', managerId: 'sam-ochoa' }}
        onClose={() => undefined}
      />
    </AppProviders>,
  );

describe('WarehouseDialog query safety', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
    cleanup();
  });

  it.each(['people', 'warehouses'] as const)('fails closed while the %s source is pending', async (source) => {
    const baseApi = createMockApi();
    let release: (() => void) | undefined;
    const api = {
      ...baseApi,
      admin: {
        ...baseApi.admin,
        ...(source === 'people'
          ? { listPeople: async () => new Promise<never>((resolve) => (release = () => resolve([] as never))) }
          : { listWarehouses: async () => new Promise<never>((resolve) => (release = () => resolve([] as never))) }),
      },
    };
    const queryClient = createClient();
    renderDialog(api, queryClient);
    const save = await screen.findByRole('button', { name: 'Save warehouse' });
    await waitFor(() => expect(save).toBeDisabled());
    const key = source === 'people' ? queryKeys.adminPeople('sam-ochoa') : queryKeys.adminWarehouses('sam-ochoa');
    await waitFor(() => expect(queryClient.getQueryState(key)?.fetchStatus).toBe('fetching'));
    release?.();
  });

  it.each(['people', 'warehouses'] as const)('fails closed when the %s source errors', async (source) => {
    const baseApi = createMockApi();
    const api = {
      ...baseApi,
      admin: {
        ...baseApi.admin,
        ...(source === 'people'
          ? {
              listPeople: async () => {
                throw new Error('people unavailable');
              },
            }
          : {
              listWarehouses: async () => {
                throw new Error('warehouses unavailable');
              },
            }),
      },
    };
    const queryClient = createClient();
    renderDialog(api, queryClient);
    const save = await screen.findByRole('button', { name: 'Save warehouse' });
    await waitFor(() => expect(save).toBeDisabled());
    const key = source === 'people' ? queryKeys.adminPeople('sam-ochoa') : queryKeys.adminWarehouses('sam-ochoa');
    await waitFor(() => expect(queryClient.getQueryState(key)?.status).toBe('error'));
  });

  it.each(['people', 'warehouses'] as const)(
    'fails closed while the %s source is fetching or paused',
    async (source) => {
      const baseApi = createMockApi();
      const people = await baseApi.admin.listPeople({ actorId: 'sam-ochoa' });
      const warehouses = await baseApi.admin.listWarehouses({ actorId: 'sam-ochoa' });
      const queryClient = createClient();
      queryClient.setQueryData(queryKeys.adminPeople('sam-ochoa'), people);
      queryClient.setQueryData(queryKeys.adminWarehouses('sam-ochoa'), warehouses);
      let release: (() => void) | undefined;
      const api = {
        ...baseApi,
        admin: {
          ...baseApi.admin,
          ...(source === 'people'
            ? { listPeople: async () => new Promise<never>((resolve) => (release = () => resolve([] as never))) }
            : { listWarehouses: async () => new Promise<never>((resolve) => (release = () => resolve([] as never))) }),
        },
      };
      renderDialog(api, queryClient);
      const save = await screen.findByRole('button', { name: 'Save warehouse' });
      await waitFor(() => expect(save).not.toBeDisabled());
      const key = source === 'people' ? queryKeys.adminPeople('sam-ochoa') : queryKeys.adminWarehouses('sam-ochoa');
      void queryClient.invalidateQueries({ queryKey: key });
      await waitFor(() => expect(queryClient.getQueryState(key)?.fetchStatus).toBe('fetching'));
      expect(save).toBeDisabled();
      await queryClient.cancelQueries({ queryKey: key });
      onlineManager.setOnline(false);
      void queryClient.invalidateQueries({ queryKey: key });
      await waitFor(() => expect(queryClient.getQueryState(key)?.fetchStatus).toBe('paused'));
      expect(save).toBeDisabled();
      await queryClient.cancelQueries({ queryKey: key });
      onlineManager.setOnline(true);
      release?.();
    },
  );
});
