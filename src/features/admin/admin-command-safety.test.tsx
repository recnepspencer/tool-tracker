import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMockApi } from '../../api/mock/create-mock-api';
import { AppRoutes } from '../../app/app-routes';
import { createMemorySessionStore, renderApp } from '../../test/render-app';
import { chooseFieldOption } from '../../test/choose-field-option';

describe('admin command safety', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/admin/people';
  });

  it('allows only one in-flight role command and preserves the changed choice', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    let calls = 0;
    let resolveRole: (() => void) | undefined;
    const api = {
      ...baseApi,
      admin: {
        ...baseApi.admin,
        updatePersonRole: async (input: {
          actorId: string;
          personId: string;
          role: 'worker' | 'warehouse-manager' | 'admin';
        }) => {
          calls += 1;
          await new Promise<void>((resolve) => {
            resolveRole = resolve;
          });
          return baseApi.admin.updatePersonRole(input);
        },
      },
    };
    renderApp(<AppRoutes />, { api, sessionStore: createMemorySessionStore('sam-ochoa') });
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('link', { name: 'Casey Reed' }));
    const drawer = await screen.findByRole('dialog', { name: 'Person details for Casey Reed' });
    const role = within(drawer).getByLabelText('Role');
    await chooseFieldOption(user, role, 'Warehouse manager');
    const saveRole = within(drawer).getByRole('button', { name: 'Save role' });
    await user.click(saveRole);
    await waitFor(() => expect(saveRole).toBeDisabled());
    await user.click(saveRole);
    expect(calls).toBe(1);
    resolveRole?.();
    await waitFor(() =>
      expect(within(drawer).getByText('Warehouse manager', { selector: 'strong' })).toBeInTheDocument(),
    );
    expect(calls).toBe(1);
  });

  it('preserves a selected role and error after a rejected role command', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    const api = {
      ...baseApi,
      admin: {
        ...baseApi.admin,
        updatePersonRole: async () => {
          throw new Error('role service unavailable');
        },
      },
    };
    renderApp(<AppRoutes />, { api, sessionStore: createMemorySessionStore('sam-ochoa') });
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('link', { name: 'Casey Reed' }));
    const drawer = await screen.findByRole('dialog', { name: 'Person details for Casey Reed' });
    const role = within(drawer).getByLabelText('Role');
    await chooseFieldOption(user, role, 'Warehouse manager');
    await user.click(within(drawer).getByRole('button', { name: 'Save role' }));
    expect(await within(drawer).findByText('role service unavailable')).toBeInTheDocument();
    expect(role).toHaveTextContent('Warehouse manager');
  });

  it('restores a suspended person through the query-backed access command', async () => {
    const user = userEvent.setup();
    renderApp(<AppRoutes />, { api: createMockApi(), sessionStore: createMemorySessionStore('sam-ochoa') });
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('link', { name: 'Taylor Nguyen' }));
    const drawer = await screen.findByRole('dialog', { name: 'Person details for Taylor Nguyen' });
    expect(within(drawer).getByText('Suspended', { selector: 'strong' })).toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: 'Restore access' }));
    await waitFor(() => expect(within(drawer).getByText('Active', { selector: 'strong' })).toBeInTheDocument());
  });

  it('keeps access and removal drafts after failed commands', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    let accessCalls = 0;
    let removeCalls = 0;
    const api = {
      ...baseApi,
      admin: {
        ...baseApi.admin,
        setPersonAccess: async () => {
          accessCalls += 1;
          throw new Error('access service unavailable');
        },
        removePerson: async () => {
          removeCalls += 1;
          throw new Error('removal service unavailable');
        },
      },
    };
    renderApp(<AppRoutes />, { api, sessionStore: createMemorySessionStore('sam-ochoa') });
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('link', { name: 'Casey Reed' }));
    const drawer = await screen.findByRole('dialog', { name: 'Person details for Casey Reed' });
    await user.click(within(drawer).getByRole('button', { name: 'Suspend' }));
    expect(await screen.findByText('access service unavailable')).toBeInTheDocument();
    expect(accessCalls).toBe(1);
    await user.type(within(drawer).getByLabelText('Removal reason'), 'Contract ended');
    await user.type(within(drawer).getByLabelText('Removal note'), 'Keep custody history');
    await user.click(within(drawer).getByRole('button', { name: 'Remove person' }));
    expect(await screen.findByText('removal service unavailable')).toBeInTheDocument();
    expect(removeCalls).toBe(1);
    expect(within(drawer).getByLabelText('Removal reason')).toHaveValue('Contract ended');
    expect(within(drawer).getByLabelText('Removal note')).toHaveValue('Keep custody history');
  });

  it('disables duplicate access submissions while the command is pending', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    let calls = 0;
    let resolveAccess: (() => void) | undefined;
    const api = {
      ...baseApi,
      admin: {
        ...baseApi.admin,
        setPersonAccess: async (input: { actorId: string; personId: string; access: 'active' | 'suspended' }) => {
          calls += 1;
          await new Promise<void>((resolve) => {
            resolveAccess = resolve;
          });
          return baseApi.admin.setPersonAccess(input);
        },
      },
    };
    renderApp(<AppRoutes />, { api, sessionStore: createMemorySessionStore('sam-ochoa') });
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('link', { name: 'Casey Reed' }));
    const drawer = await screen.findByRole('dialog', { name: 'Person details for Casey Reed' });
    const suspend = within(drawer).getByRole('button', { name: 'Suspend' });
    await user.click(suspend);
    await waitFor(() => expect(suspend).toBeDisabled());
    await user.click(suspend);
    expect(calls).toBe(1);
    resolveAccess?.();
    await waitFor(() => expect(within(drawer).getByText('Suspended', { selector: 'strong' })).toBeInTheDocument());
  });

  it('disables duplicate removal submissions while the command is pending', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    let calls = 0;
    let resolveRemove: (() => void) | undefined;
    const api = {
      ...baseApi,
      admin: {
        ...baseApi.admin,
        removePerson: async (input: { actorId: string; personId: string; reason: string }) => {
          calls += 1;
          await new Promise<void>((resolve) => {
            resolveRemove = resolve;
          });
          return baseApi.admin.removePerson(input);
        },
      },
    };
    renderApp(<AppRoutes />, { api, sessionStore: createMemorySessionStore('sam-ochoa') });
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('link', { name: 'Casey Reed' }));
    const drawer = await screen.findByRole('dialog', { name: 'Person details for Casey Reed' });
    await user.type(within(drawer).getByLabelText('Removal reason'), 'Contract ended');
    const remove = within(drawer).getByRole('button', { name: 'Remove person' });
    await user.click(remove);
    await waitFor(() => expect(remove).toBeDisabled());
    await user.click(remove);
    expect(calls).toBe(1);
    resolveRemove?.();
    await waitFor(() => expect(within(drawer).getByText('Removed', { selector: 'strong' })).toBeInTheDocument());
  });

  it('allows only one warehouse update and keeps the draft after a rejection', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    let calls = 0;
    let rejectUpdate: ((error: Error) => void) | undefined;
    const api = {
      ...baseApi,
      admin: {
        ...baseApi.admin,
        updateWarehouse: async () => {
          calls += 1;
          await new Promise<never>((_, reject) => {
            rejectUpdate = reject;
          });
          throw new Error('warehouse update unavailable');
        },
      },
    };
    window.location.hash = '#/admin/warehouses';
    renderApp(<AppRoutes />, { api, sessionStore: createMemorySessionStore('sam-ochoa') });
    const card = (await screen.findByText('North Yard')).closest('.surface-card');
    expect(card).not.toBeNull();
    await user.click(within(card as HTMLElement).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit warehouse' });
    const name = within(dialog).getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'North Yard Updated');
    const save = within(dialog).getByRole('button', { name: 'Save warehouse' });
    await user.click(save);
    await waitFor(() => expect(save).toBeDisabled());
    await user.click(save);
    expect(calls).toBe(1);
    rejectUpdate?.(new Error('warehouse update unavailable'));
    expect(await screen.findByText('warehouse update unavailable')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Name')).toHaveValue('North Yard Updated');
    expect(within(dialog).getByLabelText('Address')).toHaveValue('1420 Kerr Ave');
    expect(within(dialog).getByLabelText('Manager')).toHaveTextContent('Sam Ochoa');
  });
});
