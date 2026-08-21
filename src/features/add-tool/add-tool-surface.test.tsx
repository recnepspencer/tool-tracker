import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMockApi } from '../../api/mock/create-mock-api';
import { createMockDatabase } from '../../api/mock/mock-database';
import { AppRoutes } from '../../app/app-routes';
import { createMemorySessionStore, renderApp } from '../../test/render-app';
import { QueryProjectionProbe } from '../../test/QueryProjectionProbe';
import { chooseFieldOption } from '../../test/choose-field-option';

describe('add-tool surface', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/worker/tools';
  });

  async function openAddTool(user: ReturnType<typeof userEvent.setup>) {
    await screen.findByRole('heading', { name: 'My tools' });
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    await user.click(screen.getByRole('button', { name: /Add a tool Setup/ }));
  }

  it('completes the capture and details flow through ToolsApi', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase({ clock: () => '2026-08-18T09:00:00-06:00' });
    renderApp(<AppRoutes />, { api: createMockApi(database), sessionStore: createMemorySessionStore('ray-torres') });
    expect(await screen.findByRole('heading', { name: 'My tools' })).toBeInTheDocument();
    await openAddTool(user);
    const dialog = await screen.findByRole('dialog', { name: 'Add a tool' });
    await user.click(within(dialog).getByRole('button', { name: 'Capture photo' }));
    await user.type(within(dialog).getByLabelText('Tool name'), 'Voltage probe');
    await chooseFieldOption(user, within(dialog).getByRole('combobox', { name: 'Category' }), 'Meters & testers');
    await user.click(within(dialog).getByRole('button', { name: 'Add to my tools' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add a tool' })).not.toBeInTheDocument());
    expect(database.read().units.some((unit) => unit.photoKey === 'tool-photo-placeholder.svg')).toBe(true);
    expect(database.read().definitions.some((definition) => definition.name === 'Voltage probe')).toBe(true);
    expect(await screen.findByText('Voltage probe')).toBeInTheDocument();
  });

  it('refetches active catalog, activity, and admin projections after creation', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase({ clock: () => '2026-08-18T09:00:00-06:00' });
    const baseApi = createMockApi(database);
    const calls = { tools: 0, catalog: 0, activity: 0, adminSummary: 0 };
    const api = {
      ...baseApi,
      tools: {
        ...baseApi.tools,
        listTools: async () => {
          calls.tools += 1;
          return baseApi.tools.listTools();
        },
        listCatalog: async () => {
          calls.catalog += 1;
          return baseApi.tools.listCatalog();
        },
      },
      activity: {
        ...baseApi.activity,
        listActivity: async () => {
          calls.activity += 1;
          return baseApi.activity.listActivity();
        },
      },
      admin: {
        ...baseApi.admin,
        getSummary: async () => {
          calls.adminSummary += 1;
          return baseApi.admin.getSummary({ actorId: 'sam-ochoa' });
        },
      },
    };
    renderApp(
      <>
        <AppRoutes />
        <QueryProjectionProbe toolUnitId="TL-101" />
      </>,
      { api, sessionStore: createMemorySessionStore('ray-torres') },
    );
    expect(await screen.findByRole('heading', { name: 'My tools' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('projection-probe')).toHaveTextContent('ready'));
    const beforeCalls = { ...calls };
    const beforeProjection = { ...screen.getByTestId('projection-probe').dataset };
    await openAddTool(user);
    const dialog = await screen.findByRole('dialog', { name: 'Add a tool' });
    await user.click(within(dialog).getByRole('button', { name: 'Capture photo' }));
    await user.type(within(dialog).getByLabelText('Tool name'), 'Current clamp');
    await chooseFieldOption(user, within(dialog).getByRole('combobox', { name: 'Category' }), 'Meters & testers');
    await user.click(within(dialog).getByRole('button', { name: 'Add to my tools' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add a tool' })).not.toBeInTheDocument());
    await waitFor(() => {
      expect(calls.tools).toBeGreaterThan(beforeCalls.tools);
      expect(calls.catalog).toBeGreaterThan(beforeCalls.catalog);
      expect(calls.activity).toBeGreaterThan(beforeCalls.activity);
      expect(calls.adminSummary).toBeGreaterThan(beforeCalls.adminSummary);
    });
    const afterProjection = screen.getByTestId('projection-probe').dataset;
    expect(Number(afterProjection.workerToolCount)).toBe(Number(beforeProjection.workerToolCount) + 1);
    expect(Number(afterProjection.toolCount)).toBe(Number(beforeProjection.toolCount) + 1);
    expect(Number(afterProjection.catalogCount)).toBe(Number(beforeProjection.catalogCount) + 1);
    expect(Number(afterProjection.activityCount)).toBeGreaterThan(Number(beforeProjection.activityCount));
    expect(Number(afterProjection.adminRecentCount)).toBeGreaterThan(Number(beforeProjection.adminRecentCount));
  });

  it('preserves the capture and details draft when creation is rejected', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    const rejectingApi = {
      ...baseApi,
      tools: {
        ...baseApi.tools,
        createTool: async () => Promise.reject(new Error('creation conflict')),
      },
    };
    renderApp(<AppRoutes />, { api: rejectingApi, sessionStore: createMemorySessionStore('ray-torres') });
    await openAddTool(user);
    const dialog = await screen.findByRole('dialog', { name: 'Add a tool' });
    await user.click(within(dialog).getByRole('button', { name: 'Capture photo' }));
    await user.type(within(dialog).getByLabelText('Tool name'), 'Failed probe');
    await chooseFieldOption(user, within(dialog).getByRole('combobox', { name: 'Category' }), 'Meters & testers');
    await user.click(within(dialog).getByRole('button', { name: 'Serial, price, notes' }));
    const note = within(dialog).getByPlaceholderText('Condition or context');
    await user.type(note, 'Keep this draft');
    await user.click(within(dialog).getByRole('button', { name: 'Add to my tools' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('creation conflict');
    expect(within(dialog).getByLabelText('Tool name')).toHaveValue('Failed probe');
    expect(within(dialog).getByRole('combobox', { name: 'Category' })).toHaveValue('Meters & testers');
    expect(note).toHaveValue('Keep this draft');
  });
});
