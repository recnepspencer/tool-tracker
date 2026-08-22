import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppRoutes } from '../../app/app-routes';
import { createMockApi } from '../../api/mock/create-mock-api';
import { createMockDatabase } from '../../api/mock/mock-database';
import { createMemorySessionStore, renderApp } from '../../test/render-app';
import { chooseFieldOption, openFieldOptions } from '../../test/choose-field-option';

describe('admin route surfaces', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/admin/people';
  });

  it('guards and renders the new people, permissions, and warehouse destinations', async () => {
    const user = userEvent.setup();
    renderApp(<AppRoutes />, { sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('heading', { name: 'People' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Access' }));
    expect(await screen.findByRole('heading', { name: 'Access guide' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Warehouses' }));
    expect(await screen.findByRole('heading', { name: 'Warehouses' })).toBeInTheDocument();
  });

  it('keeps opaque person IDs in one encoded route segment and decodes them for the detail query', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    const people = await baseApi.admin.listPeople!({ actorId: 'sam-ochoa' });
    const source = people.find((person) => person.id === 'avery-cole')!;
    const sourceDetail = await baseApi.admin.getPerson!({ actorId: 'sam-ochoa', personId: 'avery-cole' });
    let requestedPersonId = '';
    const api = {
      ...baseApi,
      admin: {
        ...baseApi.admin,
        listPeople: async () => [{ ...source, id: 'avery/cole', name: 'Avery / Cole' }],
        getPerson: async (input: { actorId: string; personId: string }) => {
          requestedPersonId = input.personId;
          return { ...sourceDetail, id: 'avery/cole', name: 'Avery / Cole' };
        },
      },
    };
    renderApp(<AppRoutes />, { api, sessionStore: createMemorySessionStore('sam-ochoa') });
    const link = await screen.findByRole('link', { name: 'Avery / Cole' });
    expect(link).toHaveAttribute('href', '#/admin/people/avery%2Fcole');
    await user.click(link);
    expect(await screen.findByRole('dialog', { name: 'Person details for Avery / Cole' })).toBeInTheDocument();
    expect(requestedPersonId).toBe('avery/cole');
  });

  it('opens admin forms without crossing the adapter boundary', async () => {
    const user = userEvent.setup();
    renderApp(<AppRoutes />, { sessionStore: createMemorySessionStore('sam-ochoa') });
    await user.click(await screen.findByRole('button', { name: 'Invite person' }));
    expect(await screen.findByRole('dialog', { name: 'Invite a person' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('link', { name: 'Warehouses' }));
    await user.click(await screen.findByRole('button', { name: 'Add warehouse' }));
    expect(await screen.findByRole('dialog', { name: 'Create warehouse' })).toBeInTheDocument();
  });

  it('keeps the admin mobile navigation modal, labeled, and keyboard-safe', async () => {
    const user = userEvent.setup();
    renderApp(<AppRoutes />, { sessionStore: createMemorySessionStore('sam-ochoa') });
    await screen.findByRole('heading', { name: 'People' });
    const open = screen.getByLabelText('Open navigation');
    await user.click(open);
    const navigation = screen.getByRole('dialog', { name: 'Admin navigation' });
    expect(navigation).toHaveAttribute('aria-modal', 'true');
    expect(within(navigation).getByRole('button', { name: 'Open account for Sam Ochoa' })).toBeInTheDocument();
    expect(within(navigation).getByRole('switch', { name: 'Appearance' })).toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: 'People' })).toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: 'Queue' })).toHaveAttribute('href', '#/admin/operations/queue');
    expect(navigation.querySelectorAll('.worker-drawer-link-icon')).toHaveLength(10);
    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveFocus();
    await user.keyboard('{Tab}');
    expect(navigation).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Admin navigation' })).not.toBeInTheDocument();
    expect(open).toHaveFocus();

    await user.click(open);
    await user.click(screen.getByRole('button', { name: 'Open account for Sam Ochoa' }));
    const account = screen.getByRole('dialog', { name: 'Sam Ochoa' });
    expect(within(account).getByText('sam@nelsonelectric.com')).toBeInTheDocument();
    expect(within(account).queryByRole('switch', { name: 'Appearance' })).not.toBeInTheDocument();
  });

  it('filters people and keeps role, access, and removal commands visible after refetch', async () => {
    const user = userEvent.setup();
    renderApp(<AppRoutes />, { sessionStore: createMemorySessionStore('sam-ochoa') });
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Casey Reed')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Invited' }));
    expect(within(table).getByText('Casey Reed')).toBeInTheDocument();
    expect(within(table).queryByText('Ray Torres')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Everyone' }));
    await user.click(screen.getByRole('tab', { name: 'No access' }));
    expect(within(table).getByText('Casey Reed')).toBeInTheDocument();
    expect(within(table).getByText('Taylor Nguyen')).toBeInTheDocument();
    expect(within(table).getByText('Quinn Hart')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Admins' }));
    expect(within(table).getByText('Sam Ochoa')).toBeInTheDocument();
    expect(within(table).queryByText('Casey Reed')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Everyone' }));
    await user.click(within(table).getByRole('link', { name: 'Casey Reed' }));
    const drawer = await screen.findByRole('dialog', { name: 'Person details for Casey Reed' });
    await chooseFieldOption(user, within(drawer).getByLabelText('Role'), 'Warehouse manager');
    await user.click(within(drawer).getByRole('button', { name: 'Save role' }));
    await waitForVisibleText(drawer, 'Warehouse manager');
    await user.click(within(drawer).getByRole('button', { name: 'Suspend' }));
    await waitForVisibleText(drawer, 'Suspended');
    await user.type(within(drawer).getByLabelText('Removal reason'), 'Contract ended');
    await user.click(within(drawer).getByRole('button', { name: 'Remove person' }));
    await waitForVisibleText(drawer, 'Removed');
  });

  it('searches people by normalized text, filters roles, and states empty results', async () => {
    const user = userEvent.setup();
    renderApp(<AppRoutes />, { sessionStore: createMemorySessionStore('sam-ochoa') });
    const table = await screen.findByRole('table');
    const search = screen.getByLabelText('Search people');
    await user.type(search, '  CASEY@NELSONELECTRIC.COM  ');
    expect(within(table).getByText('Casey Reed')).toBeInTheDocument();
    expect(within(table).queryByText('Ray Torres')).not.toBeInTheDocument();
    await user.clear(search);
    await user.click(screen.getByRole('tab', { name: 'Admins' }));
    expect(within(table).getByText('Sam Ochoa')).toBeInTheDocument();
    expect(within(table).getByText('Morgan Price')).toBeInTheDocument();
    expect(within(table).queryByText('Ray Torres')).not.toBeInTheDocument();
    await user.type(search, 'no such person');
    expect(screen.getByText('No people match this filter.')).toBeInTheDocument();
  });

  it('renders every policy role and capability and retries a dashboard error', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    let summaryCalls = 0;
    const api = {
      ...baseApi,
      admin: {
        ...baseApi.admin,
        getSummary: async (input: { actorId: string }) => {
          summaryCalls += 1;
          if (summaryCalls === 1) throw new Error('dashboard unavailable');
          return baseApi.admin.getSummary(input);
        },
      },
    };
    renderApp(<AppRoutes />, { api, sessionStore: createMemorySessionStore('sam-ochoa') });
    await user.click(await screen.findByRole('link', { name: 'Access' }));
    expect(await screen.findByRole('heading', { name: 'Access guide' })).toBeInTheDocument();
    expect(screen.getAllByText('Worker').length).toBeGreaterThan(0);
    expect(screen.getByText('Request tools')).toBeInTheDocument();
    expect(screen.getAllByText('Warehouse manager').length).toBeGreaterThan(0);
    expect(screen.getByText('Manage warehouse')).toBeInTheDocument();
    expect(screen.getAllByText('Administrator').length).toBeGreaterThan(0);
    expect(screen.getByText('Administer people')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Locked rules' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Locked structural rules' })).toHaveTextContent(
      'Every handoff requires an accepting party before custody changes.',
    );
    expect(screen.getByRole('list', { name: 'Locked structural rules' })).toHaveTextContent(
      'The audit trail is immutable, including for administrators and owners.',
    );
    expect(screen.getByRole('list', { name: 'Locked structural rules' })).toHaveTextContent(
      'Only administrators can invite, change, suspend, or remove people.',
    );
    await user.click(screen.getByRole('link', { name: 'Dashboard' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('admin dashboard could not be loaded');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'Control room' })).toBeInTheDocument();
  });

  it('renders the dashboard attention facts and newest movement from the admin projection', async () => {
    const user = userEvent.setup();
    const api = createMockApi(createMockDatabase({ clock: () => '2026-08-18T09:00:00-06:00' }));
    renderApp(<AppRoutes />, { api, sessionStore: createMemorySessionStore('sam-ochoa') });
    await user.click(await screen.findByRole('link', { name: 'Dashboard' }));
    expect(await screen.findByRole('heading', { name: 'Control room' })).toBeInTheDocument();
    const pending = screen.getByText('Handoffs waiting for a decision.').closest('section');
    const longHeld = screen.getByText('Worker custody older than seven days.').closest('section');
    expect(pending).toHaveTextContent('3');
    expect(longHeld).toHaveTextContent('1');
    expect(screen.getByText(/TL-103/)).toBeInTheDocument();
    expect(screen.getByText('Completed the Riverside Depot cycle count')).toBeInTheDocument();
    expect(Array.from(document.querySelectorAll('.activity-row strong'))[0]).toHaveTextContent(
      'Completed the Riverside Depot cycle count',
    );
    expect(document.querySelector('.activity-row time')).toHaveAttribute('datetime', '2026-08-18T09:20:00-06:00');
  });

  it('states dashboard empty coverage and movement explicitly', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    const api = {
      ...baseApi,
      admin: {
        ...baseApi.admin,
        getSummary: async () => ({
          totalTools: 0,
          checkedOut: 0,
          inStock: 0,
          flagged: 0,
          warehouses: [],
          recentEvents: [],
          pendingApprovals: 0,
          longHeldTools: [],
        }),
      },
    };
    renderApp(<AppRoutes />, { api, sessionStore: createMemorySessionStore('sam-ochoa') });
    await user.click(await screen.findByRole('link', { name: 'Dashboard' }));
    expect(await screen.findByRole('heading', { name: 'Control room' })).toBeInTheDocument();
    expect(screen.getByText('No warehouse coverage is available.')).toBeInTheDocument();
    expect(screen.getByText('No recent movement recorded.')).toBeInTheDocument();
  });

  it('renders permission loading and error states through the query boundary', async () => {
    const user = userEvent.setup();
    const pendingApi = {
      ...createMockApi(),
      admin: { ...createMockApi().admin, getPermissionMatrix: async () => await new Promise<never>(() => {}) },
    };
    window.location.hash = '#/admin/permissions';
    renderApp(<AppRoutes />, { api: pendingApi, sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('status')).toHaveTextContent('Loading permissions');

    cleanup();
    const recoveryApi = createMockApi();
    let permissionCalls = 0;
    const errorApi = {
      ...recoveryApi,
      admin: {
        ...recoveryApi.admin,
        getPermissionMatrix: async (input: Parameters<typeof recoveryApi.admin.getPermissionMatrix>[0]) => {
          permissionCalls += 1;
          if (permissionCalls === 1) throw new Error('offline');
          return recoveryApi.admin.getPermissionMatrix(input);
        },
      },
    };
    renderApp(<AppRoutes />, { api: errorApi, sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('alert')).toHaveTextContent('permission matrix could not be loaded');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'Access guide' })).toBeInTheDocument();
  });

  it('renders warehouse loading, error, and empty states through the query boundary', async () => {
    const user = userEvent.setup();
    const pendingApi = {
      ...createMockApi(),
      admin: { ...createMockApi().admin, listWarehouses: async () => await new Promise<never>(() => {}) },
    };
    window.location.hash = '#/admin/warehouses';
    renderApp(<AppRoutes />, { api: pendingApi, sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('status')).toHaveTextContent('Loading warehouses');

    cleanup();
    const recoveryApi = createMockApi();
    let warehouseCalls = 0;
    const errorApi = {
      ...recoveryApi,
      admin: {
        ...recoveryApi.admin,
        listWarehouses: async (input: Parameters<typeof recoveryApi.admin.listWarehouses>[0]) => {
          warehouseCalls += 1;
          if (warehouseCalls === 1) throw new Error('offline');
          return recoveryApi.admin.listWarehouses(input);
        },
      },
    };
    renderApp(<AppRoutes />, { api: errorApi, sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('alert')).toHaveTextContent('warehouse directory could not be loaded');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'Warehouses' })).toBeInTheDocument();

    cleanup();
    const emptyApi = {
      ...createMockApi(),
      admin: { ...createMockApi().admin, listWarehouses: async () => [] },
    };
    renderApp(<AppRoutes />, { api: emptyApi, sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('heading', { name: 'Warehouses' })).toBeInTheDocument();
    expect(screen.getByText('No warehouses are configured.')).toBeInTheDocument();
  });

  it('creates and edits a warehouse from eligible manager choices', async () => {
    const user = userEvent.setup();
    renderApp(<AppRoutes />, { sessionStore: createMemorySessionStore('sam-ochoa') });
    await screen.findByRole('heading', { name: 'People' });
    await user.click(screen.getByRole('link', { name: 'Warehouses' }));
    expect(await screen.findByRole('heading', { name: 'Warehouses' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add warehouse' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create warehouse' });
    const managerOptions = await openFieldOptions(user, within(dialog).getByRole('combobox', { name: 'Manager' }));
    expect(within(managerOptions).getByRole('option', { name: /Morgan Price/ })).toBeInTheDocument();
    expect(within(managerOptions).queryByRole('option', { name: /Taylor Nguyen/ })).not.toBeInTheDocument();
    await user.click(within(managerOptions).getByRole('option', { name: /Morgan Price/ }));
    await user.type(within(dialog).getByLabelText('Name'), 'West Annex');
    await user.type(within(dialog).getByLabelText('Address'), '9 Line Ave');
    await user.click(within(dialog).getByRole('button', { name: 'Save warehouse' }));
    const created = await screen.findByText('West Annex');
    const card = created.closest('.surface-card');
    expect(card).not.toBeNull();
    await user.click(within(card as HTMLElement).getByRole('button', { name: 'Edit' }));
    const editDialog = await screen.findByRole('dialog', { name: 'Edit warehouse' });
    const name = within(editDialog).getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'West Annex Updated');
    await user.click(within(editDialog).getByRole('button', { name: 'Save warehouse' }));
    expect(await screen.findByText('West Annex Updated')).toBeInTheDocument();
  });
});

async function waitForVisibleText(container: HTMLElement, text: string) {
  await waitFor(() => expect(within(container).getByText(text, { selector: 'strong' })).toBeInTheDocument());
}
