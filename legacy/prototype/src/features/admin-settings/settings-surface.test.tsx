import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMockApi } from '../../api/mock/create-mock-api';
import { createMockDatabase } from '../../api/mock/mock-database';
import { queryKeys } from '../../api/query-keys';
import { AppRoutes } from '../../app/app-routes';
import { createMemorySessionStore, createMemoryThemeStore, renderApp } from '../../test/render-app';

function RefreshSettingsAuthority() {
  const queryClient = useQueryClient();
  return (
    <button type="button" onClick={() => void queryClient.invalidateQueries({ queryKey: queryKeys.companyProfile })}>
      Refresh settings authority
    </button>
  );
}

describe('settings surface', () => {
  beforeEach(() => {
    cleanup();
    onlineManager.setOnline(true);
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/admin/settings';
  });

  afterEach(() => {
    onlineManager.setOnline(true);
    cleanup();
  });

  it('updates company and category authorities through awaited query invalidation', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase();
    renderApp(<AppRoutes />, { api: createMockApi(database), sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    const name = screen.getByRole('textbox', { name: 'Company name' });
    await user.clear(name);
    await user.type(name, 'Nelson Electric West');
    await user.click(screen.getByRole('button', { name: 'Save company' }));
    await waitFor(() => expect(database.read().company.name).toBe('Nelson Electric West'));
    const newCategory = screen.getByRole('textbox', { name: 'New category' });
    await user.type(newCategory, 'Safety');
    await user.click(screen.getByRole('button', { name: 'Add category' }));
    await waitFor(() => expect(database.read().categories.some((category) => category.name === 'Safety')).toBe(true));
    expect(await screen.findByText('Safety')).toBeInTheDocument();
  });

  it('preserves failed company drafts and exposes mutation errors', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    const api = {
      ...baseApi,
      settings: {
        ...baseApi.settings,
        updateCompany: async () => Promise.reject(new Error('company conflict')),
      },
    };
    renderApp(<AppRoutes />, { api, sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    const name = screen.getByRole('textbox', { name: 'Company name' });
    await user.clear(name);
    await user.type(name, 'Keep this draft');
    await user.click(screen.getByRole('button', { name: 'Save company' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('company conflict');
    expect(name).toHaveValue('Keep this draft');
  });

  it('renames by stable category ID, disables used-category deletion, and deletes an unused category', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase();
    renderApp(<AppRoutes />, { api: createMockApi(database), sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();

    const powerTools = screen.getByText('Power tools').closest('.category-row') as HTMLElement;
    expect(within(powerTools).getByRole('button', { name: 'Delete' })).toBeDisabled();
    await user.click(within(powerTools).getByRole('button', { name: 'Rename' }));
    const rename = within(powerTools).getByRole('textbox', { name: 'Rename Power tools' });
    await user.clear(rename);
    await user.type(rename, 'Power equipment');
    await user.click(within(powerTools).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(database.read().categories.find((category) => category.id === 'category-power-tools')?.name).toBe(
        'Power equipment',
      ),
    );
    expect(await screen.findByText('Power equipment')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'New category' }), 'Safety');
    await user.click(screen.getByRole('button', { name: 'Add category' }));
    const safety = await screen.findByText('Safety');
    const safetyRow = safety.closest('.category-row') as HTMLElement;
    await user.click(within(safetyRow).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(database.read().categories.some((category) => category.name === 'Safety')).toBe(false));
    expect(screen.queryByText('Safety')).not.toBeInTheDocument();
  });

  it('preserves a failed category draft and reports the adapter error', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    const api = {
      ...baseApi,
      settings: {
        ...baseApi.settings,
        createCategory: async () => Promise.reject(new Error('category conflict')),
      },
    };
    renderApp(<AppRoutes />, { api, sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    const draft = screen.getByRole('textbox', { name: 'New category' });
    await user.type(draft, 'Safety');
    await user.click(screen.getByRole('button', { name: 'Add category' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('category conflict');
    expect(draft).toHaveValue('Safety');
  });

  it('requires exact reset confirmation and preserves the session and theme stores', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase();
    const themeStore = createMemoryThemeStore('light');
    const sessionStore = createMemorySessionStore('sam-ochoa');
    const baseApi = createMockApi(database);
    let submittedConfirmation = '';
    const api = {
      ...baseApi,
      settings: {
        ...baseApi.settings,
        resetDemoData: async (input: Parameters<typeof baseApi.settings.resetDemoData>[0]) => {
          submittedConfirmation = input.confirmation;
          return baseApi.settings.resetDemoData(input);
        },
      },
    };
    await api.settings.updateCompany({
      actorId: 'sam-ochoa',
      expectedRevision: 1,
      name: 'Changed',
      address: 'Changed',
    });
    renderApp(<AppRoutes />, { api, sessionStore, themeStore });
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset workspace data' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reset workspace data' });
    const reset = within(dialog).getByRole('button', { name: 'Reset data' });
    expect(reset).toBeDisabled();
    await user.type(within(dialog).getByRole('textbox', { name: 'Confirmation' }), 'RESET WORKSPACE DATA');
    await user.click(reset);
    await waitFor(() => expect(database.read().company.name).toBe('Nelson Electric'));
    expect(submittedConfirmation).toBe('RESET WORKSPACE DATA');
    expect(sessionStore.value).toBe('sam-ochoa');
    expect(themeStore.value).toBe('light');
    expect(screen.queryByRole('dialog', { name: 'Reset workspace data' })).not.toBeInTheDocument();
  });

  it('blocks company commands while the authoritative settings query refetches, pauses, or errors', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    let companyCalls = 0;
    let updateCalls = 0;
    let holdNextCompany = false;
    let failNextCompany = false;
    let releaseCompany: (() => void) | undefined;
    const api = {
      ...baseApi,
      settings: {
        ...baseApi.settings,
        getCompany: async (input: Parameters<typeof baseApi.settings.getCompany>[0]) => {
          companyCalls += 1;
          if (failNextCompany) {
            failNextCompany = false;
            throw new Error('settings offline');
          }
          const result = await baseApi.settings.getCompany(input);
          if (holdNextCompany) {
            holdNextCompany = false;
            await new Promise<void>((resolve) => {
              releaseCompany = resolve;
            });
          }
          return result;
        },
        updateCompany: async (input: Parameters<typeof baseApi.settings.updateCompany>[0]) => {
          updateCalls += 1;
          return baseApi.settings.updateCompany(input);
        },
      },
    };
    renderApp(
      <>
        <AppRoutes />
        <RefreshSettingsAuthority />
      </>,
      { api, sessionStore: createMemorySessionStore('sam-ochoa') },
    );
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    const name = screen.getByRole('textbox', { name: 'Company name' });
    const save = screen.getByRole('button', { name: 'Save company' });
    await user.clear(name);
    await user.type(name, 'Keep this settings draft');
    holdNextCompany = true;
    await user.click(screen.getByRole('button', { name: 'Refresh settings authority' }));
    await waitFor(() => expect(companyCalls).toBeGreaterThan(1));
    expect(save).toBeDisabled();
    await user.click(save);
    expect(updateCalls).toBe(0);
    releaseCompany?.();
    await waitFor(() => expect(save).toBeEnabled());

    onlineManager.setOnline(false);
    await user.click(screen.getByRole('button', { name: 'Refresh settings authority' }));
    await waitFor(() => expect(save).toBeDisabled());
    await user.click(save);
    expect(updateCalls).toBe(0);
    onlineManager.setOnline(true);
    await waitFor(() => expect(save).toBeEnabled());

    failNextCompany = true;
    await user.click(screen.getByRole('button', { name: 'Refresh settings authority' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Settings could not be loaded');
    expect(updateCalls).toBe(0);
  });

  it('fails closed for reset while settings authority is fetching or paused', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    let companyCalls = 0;
    let resetCalls = 0;
    let holdNextCompany = false;
    let releaseCompany: (() => void) | undefined;
    const api = {
      ...baseApi,
      settings: {
        ...baseApi.settings,
        getCompany: async (input: Parameters<typeof baseApi.settings.getCompany>[0]) => {
          companyCalls += 1;
          const result = await baseApi.settings.getCompany(input);
          if (holdNextCompany) {
            holdNextCompany = false;
            await new Promise<void>((resolve) => {
              releaseCompany = resolve;
            });
          }
          return result;
        },
        resetDemoData: async (input: Parameters<typeof baseApi.settings.resetDemoData>[0]) => {
          resetCalls += 1;
          return baseApi.settings.resetDemoData(input);
        },
      },
    };
    renderApp(
      <>
        <AppRoutes />
        <RefreshSettingsAuthority />
      </>,
      { api, sessionStore: createMemorySessionStore('sam-ochoa') },
    );
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    const reset = screen.getByRole('button', { name: 'Reset workspace data' });
    await waitFor(() => expect(reset).toBeEnabled());

    holdNextCompany = true;
    await user.click(screen.getByRole('button', { name: 'Refresh settings authority' }));
    await waitFor(() => expect(companyCalls).toBeGreaterThan(1));
    expect(reset).toBeDisabled();
    expect(resetCalls).toBe(0);
    releaseCompany?.();
    await waitFor(() => expect(reset).toBeEnabled());

    onlineManager.setOnline(false);
    await user.click(screen.getByRole('button', { name: 'Refresh settings authority' }));
    await waitFor(() => expect(reset).toBeDisabled());
    expect(resetCalls).toBe(0);
  });
});
